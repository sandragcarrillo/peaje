# PeajeSettlementV3: split sin custodia en cada red EVM

Octubre 2026. El modelo de Tempo (98% directo a la wallet del negocio, 2% a Peaje, en la misma transacción) pasa a Arbitrum, Robinhood Chain y Arc. El contrato no guarda saldos, no le debe nada a nadie y no tiene retiros. Primero testnets, después las tres mainnets juntas tras una revisión externa.

Código: `contracts/src/PeajeSettlementV3.sol`. Tests: `contracts/test/v3/`. Deploy: `contracts/script/DeployPeajeSettlementV3.s.sol`. v2 (`PeajeSettlement.sol`) queda en el repo sin cambios: sus contratos en testnet todavía guardan saldos de negocios.

## Qué cambia frente a v2

| | v2 | v3 |
|---|---|---|
| Dónde queda la plata del negocio | `claimable` dentro del contrato | en la wallet del negocio, en la transacción del pago |
| Retiro | `withdraw` / `withdrawWithSignature` (EIP-712, nonces) | no existe: no hay nada que retirar |
| Saldo del contrato después de cada llamada | lo adeudado (`totalOwed`) | 0 (lo verifica el propio `settle` y un invariante) |
| Fee | `feeBps` configurable por el owner, hasta 10% | `FEE_BPS = 200` constante, 2%. Cambiarlo es otro deploy |
| Pago adelantado al token (front-run) | `recoverSurplus` manda el excedente a donde diga el owner | `settleStray` lo reparte igual que `settle`; nunca se barre a Peaje |
| Roles | owner, relayer y fee recipient eran la misma dirección en los deploys de testnet | owner (Safe), guardian (solo pausa), relayers (llaves calientes) y fee recipient (frío), separados |
| Alta de roles y tokens | transacciones del deployer después del deploy | todo en el constructor: el deployer termina sin ningún rol |
| `settleWithPermit` (EIP-2612) | sí, solo para Tempo | no: Tempo ya usa splits nativos de mppx y las tres redes de v3 tienen EIP-3009 |
| Reentrancy guard | `ReentrancyGuard` (storage) | `ReentrancyGuardTransient` (TSTORE; probado que existe en las seis redes) |
| Proxy / upgrade | no | no. Una versión nueva es un deploy nuevo |

`settle(address token, address merchant, Authorization auth, uint256 networkFee)` mantiene exactamente la firma y el selector de v2, así que la llamada del gateway no cambia. Lo que cambia es el evento:

```solidity
event PaymentSettled(
    bytes32 indexed nonce, address indexed token, address indexed merchant,
    address payer, uint256 gross, uint256 net, uint256 fee, uint256 networkFee
);
event StraySettled(bytes32 indexed nonce, address indexed token, address indexed payer); // solo marca, sin montos
```

## Por qué

- Custodia: con v2 el contrato guarda el dinero de los negocios hasta que retiran. Eso exige retiros firmados, nonces, un relayer que pague el gas del retiro y una superficie de ataque (`claimable`, `totalOwed`, `recoverSurplus`) que un revisor tiene que auditar. v3 no tiene nada de eso.
- Mismo modelo en todas las redes: el negocio ve el 98% en su wallet al instante, como en Tempo. El saldo "disponible" deja de existir para los rieles de contrato.
- Revisión más barata: v3 tiene 6.573 bytes de bytecode desplegado contra 10.591 de v2, dos funciones que mueven plata (`settle` y `settleStray`) y ningún estado contable.

## Cómo se reparte un pago

El agente firma `value = precio + networkFee` (lo que dice el 402). Con `price = value - networkFee`:

| | Monto | Va a |
|---|---|---|
| fee | `floor(price * 200 / 10000)` | fee recipient |
| networkFee | lo que elige el relayer, con tope `maxNetworkFee[token]` | fee recipient |
| net | `price - fee` | merchant |

**Redondeo: el fee redondea hacia abajo**, a favor del negocio. El negocio recibe exactamente `value - fee - networkFee`, nunca más, y nunca menos del 98% del precio. Bajo 50 unidades (US$0,00005 con 6 decimales) el fee es 0. Es la misma regla que `splitPrecio` del gateway para Tempo y que v2, así que el ledger no cambia. `quote(value, networkFee)` devuelve `(net, fee)` para chequear off-chain.

Se rechaza: `merchant` igual a `address(0)`, al contrato, al fee recipient, al owner, al guardian o a un relayer habilitado; `value <= networkFee` (incluye `value == 0`); `networkFee` sobre el tope; token no aceptado; un token que entrega menos de lo firmado (fee-on-transfer: `UnexpectedAmountReceived`); y un token que deja saldo en el contrato después del reparto (`BalanceNotRestored`).

## Modelo de seguridad

### Roles

| Rol | Quién | Puede | No puede |
|---|---|---|---|
| owner | un Safe (multisig) por red | rotar relayers y fee recipient, listar tokens y su tope de networkFee (hasta 0,10 del token), pausar, `settleStray`, transferir ownership en dos pasos | cambiar el 2%, poner un tope de networkFee sobre 0,10 del token, nombrar como merchant a quien tiene hoy un rol de Peaje (ex roles y un owner pendiente sí pueden), renunciar al ownership. Es de confianza en dos cosas: a qué merchant rutea cada excedente con `settleStray`, y que puede habilitarse a sí mismo (o a otra llave suya) como relayer y liquidar autorizaciones pendientes |
| guardian | llave rápida (EOA en hardware wallet o un Safe 1 de N), distinta de todos los demás roles | solo `pause()` | despausar, cambiar cualquier configuración, `settleStray`, liquidar pagos |
| relayer | llave caliente del gateway, con poco saldo (solo gas nativo) | `settle`: elige el merchant y el networkFee dentro del tope | nada de admin, nada con fondos sin una autorización firmada por el pagador |
| fee recipient | dirección fría (puede ser otro Safe) | recibe el 2% y el networkFee | nada: no llama al contrato |

El script de deploy exige que el owner sea un Safe de al menos 2 de 3 en mainnet (`getThreshold() >= 2`, `getOwners().length >= 3`), que el guardian exista y sea distinto del owner, del fee recipient y de los relayers, que ningún relayer sea el owner ni el fee recipient, y que los relayers sean EOAs.

### Por qué `settle` es solo de relayers

Una autorización EIP-3009 fija pagador, monto, destino (el contrato) y nonce, pero **no el merchant**. Si `settle` fuera abierto, cualquiera que viera la autorización la podría mandar a su propia dirección como "merchant". Por eso el relayer es de confianza en esa decisión, igual que en v2.

### La llave del relayer

- Una llave por red, solo con gas nativo (ETH en Arbitrum y Robinhood, USDC en Arc) para unos días de operación. Nunca tokens.
- Vive solo en el gateway (env de Railway), separada de la treasury y del fee recipient. Hoy `env.treasuryPrivateKey` hace de relayer: en v3 esa llave tiene que ser otra.
- Si se filtra: el Safe llama `setRelayer(vieja, false)` y `setRelayer(nueva, true)`. Lo peor que puede hacer quien la tenga, mientras siga habilitada, es mandar el 98% de las autorizaciones pendientes (firmadas a favor del contrato y no liquidadas) a un merchant suyo. El networkFee no es ganancia para el atacante: va al fee recipient. La ventana es la de cada autorización hasta su `validBefore`; el contrato no la acota, los clientes honestos usan minutos (300 s o lo que vence el challenge). El guardian puede llamar `pause()` de inmediato, sin esperar las firmas del Safe; el Safe después rota el relayer y despausa.

### Fee inmutable

`FEE_BPS` es una `constant`. No hay `setFee` ni `feeBps`. Un fee distinto es otro deploy y otra revisión. Lo que sí define el owner es el tope del networkFee por token, y el contrato no deja que pase de 0,10 del token (US$0,10 en una stablecoin): antes no tenía techo, y un tope mal puesto (en otros decimales, o el máximo) dejaba que el networkFee se comiera casi todo el pago.

### networkFee y su tope

El networkFee le devuelve al relayer el gas de `settle`. Lo elige el relayer en cada pago (el gateway lo calcula en `costoRed.ts`) y el contrato rechaza cualquier valor sobre `maxNetworkFee[token]`, que fija el owner por token. Topes por defecto en el script (decisión de San, 25 oct 2026; iguales en mainnet y testnet), en unidades del token (6 decimales):

| Red | Token | Tope | Costo real hoy de un settle (25 oct 2026) |
|---|---|---|---|
| Arbitrum One / Sepolia | USDC, USDG | 20.000 (US$0,02) | ~US$0,007 a 0,009 (150k a 190k gas a 0,02 gwei, ETH US$2.339) |
| Robinhood Chain / Testnet | USDG | 20.000 (US$0,02) | ~US$0,007 a 0,009 |
| Arc / Testnet | USDC | 10.000 (US$0,01) | ~US$0,003 a 0,004 (gas en USDC) |

La firma del pagador fija el `value` total, no cuánto es networkFee: el relayer lo elige hasta el tope. En pagos chicos (del orden del tope) el relayer podría dejar al negocio casi en nada, a favor del fee recipient (Peaje), no de sí mismo. El gateway lo cotiza con el gas y Chainlink y lo topa con `maxNetworkFee` del propio contrato (`costoRed.ts`). El tope no acota lo que un relayer comprometido le saca al negocio: ese riesgo es el merchant (ver arriba).

### Pausa

`pause()` bloquea `settle` y nada más. Lo pueden llamar el owner o el guardian; `unpause()` solo el owner. El guardian lo rota el owner con `setGuardian` (evento `GuardianUpdated`); no se puede dejar en cero, para retirarlo se rota a una llave del owner. El guardian sobrevive a una transferencia de ownership. Como el contrato no guarda nada, no hay fondos que congelar ni retiros que mantener abiertos. `settleStray` sigue funcionando en pausa para que el Safe pueda limpiar.

### Pago adelantado (front-run) y `settleStray`

La autorización viaja en el pago del agente, así que alguien puede mandarla directo al token antes que el relayer. Los fondos llegan al contrato sin repartir y el `settle` del relayer falla con "authorization used". Nadie gana nada con eso (el que adelanta paga el gas), pero la plata queda quieta hasta que el Safe llama:

```solidity
settleStray(token, merchant, from, value, nonce, networkFee)
```

Chequea que `authorizationState(from, nonce)` esté usado en el token, que ese `(token, from, nonce)` no se haya repartido antes por esta vía, que el saldo del contrato cubra `value` y que, después del reparto, salga exactamente `value`. Reparte igual que `settle` y emite `PaymentSettled` más `StraySettled`. El merchant y el networkFee salen del registro del 402 en Peaje.

El contrato no puede distinguir un adelanto de una donación: cualquier nonce gastado en el token pasa el primer chequeo, aunque se haya usado para pagarle a otro o con valor 0, y `value` no está atado a lo que se firmó. La prueba la hace el gateway antes de servir y anotar el excedente (`liquidacion-v3.ts`): busca la tx del `AuthorizationUsed(from, nonce)` del token y exige que en esa misma tx haya un `Transfer(from → contrato)` por exactamente `value`, sin `PaymentSettled` de ese pagador y nonce y sin `straySettled`. El Safe repite ese chequeo con los logs de la tx antes de firmar.

Diferencia con la firma del diseño: se agregó `networkFee` al final para que el reparto sea idéntico al que prometió el 402 (sin él, el negocio recibiría el 98% del networkFee también).

Límite que el Safe tiene que respetar: `settle` no registra nonces (costaría una escritura de storage por pago, unos 22k gas), así que el contrato no puede saber si ese nonce ya se liquidó por `settle`. Si hubiera dos excedentes a la vez, el Safe podría repartir el equivocado. Antes de firmar, el Safe hace el chequeo de logs de arriba.

Plata mandada al contrato sin autorización (una transferencia común) no queda atrapada: el owner la puede rutear con `settleStray` citando cualquier nonce gastado, a un merchant que no sea un rol de Peaje. Es poder del owner (el Safe), no de terceros.

## Invariantes (probadas)

1. Sin pagos adelantados, el saldo del contrato es 0 después de cada llamada (invariante estricto, 256 corridas × 64 llamadas, dos tokens de 6 y 18 decimales, pausas y rotación de fee recipient intercaladas).
2. Con pagos adelantados y donaciones, el saldo es exactamente lo adelantado sin repartir más lo donado menos lo que ruteó `settleStray`: `settle` nunca lo toca y `settleStray` mueve exactamente el `value` que le pasa el owner (que el `value` sea el de ese adelanto lo verifica el Safe, ver arriba).
3. Todo lo que sale va a merchants o fee recipients: suma a merchants = suma de `net`; suma a fee recipients = suma de `fee + networkFee`; las dos suman el bruto.
4. Cada reparto es exacto: `fee = floor(2% del precio)`, `net ≥ 98% del precio`, merchant recibe exactamente `net`.
5. Replays, networkFee sobre el tope, topes sobre 0,10 del token, un rol de Peaje como merchant y llamadas de terceros nunca pasan.
6. Dentro de `settle`, el contrato termina con el mismo saldo con que empezó, y en `settleStray` con exactamente `value` menos (`BalanceNotRestored`), comprobado on-chain en cada llamada.

Auditoría interna del 28 oct 2026 (cuatro revisiones en paralelo: caminos de pago, roles y deploy, invariantes con mutaciones, y la integración del gateway): las pruebas quedan en `contracts/test/auditoria/` y `apps/gateway/test/auditoria-liquidacion-v3.test.ts`. No es una auditoría externa.

## Riesgos conocidos (para el revisor)

- **El relayer elige el merchant.** La firma del pagador no lo fija. Mitigaciones: relayer en allowlist, rotación por el Safe, pausa, saldo bajo, ventana corta de las autorizaciones. Opción futura (no implementada): que el 402 dicte el nonce de EIP-3009 como `keccak256(merchant, salt)` y el contrato lo verifique, así la firma del agente fija al negocio. Depende de que los clientes MPP firmen el nonce que les manda el servidor.
- **Blacklists del emisor.** USDC (`isBlacklisted`) y USDG (`isFrozen`) bloquean transferencias desde y hacia direcciones. Merchant bloqueado: todo el `settle` revierte, el agente conserva su plata y la autorización queda sin usar (probado). Fee recipient bloqueado: todos los pagos de ese token fallan hasta que el Safe rote el fee recipient (probado). Contrato bloqueado: ese riel muere; se despliega otro. Token pausado por el emisor: falla igual que un merchant bloqueado.
- **Autorización sin usar tras un revert.** Si un `settle` revierte (merchant bloqueado, pausa), la autorización sigue válida hasta `validBefore` y el relayer la podría reintentar con otro merchant. El gateway no debe reintentar con un merchant distinto al del 402.
- **Front-run como molestia.** Alguien puede adelantar todos los pagos para obligar al Safe a repartirlos a mano. No roba nada y le cuesta gas. Opción futura: `receiveWithAuthorization` (exige `msg.sender == to`) elimina el caso, pero requiere que los clientes firmen ese tipo en vez de `TransferWithAuthorization`.
- **Tokens raros.** Solo se aceptan tokens que lista el owner. Fee-on-transfer al cobrar, rebasing o tokens que dejan saldo se rechazan en el mismo pago (probado con mocks). Un token que cobra su comisión solo en lo que sale del contrato no se detecta: el negocio recibe menos que el `net` del evento. USDC y USDG no cobran comisión, pero son proxies actualizables: es una propiedad del emisor.
- **Reentrancy.** `nonReentrant` en `settle` y `settleStray`; probado con un token malicioso que reentra durante el cobro y durante el reparto, incluso con el token habilitado como relayer y como owner.
- **Roles que se rotan.** El chequeo de merchant mira quién tiene cada rol en ese momento (owner, guardian, relayers, fee recipient). Si un rol se rota a una dirección que es la wallet de cobro de un negocio, los pagos y excedentes de ese negocio empiezan a revertir con `InvalidMerchant` hasta que cambie su dirección o se rote el rol. Las llaves de Peaje no se reusan como wallets de negocios.
- **Gas del primer pago.** Pagar a una wallet que nunca tuvo el token cuesta más (escritura de saldo de cero a no cero): ver la tabla de gas.

## Redes y tokens

Verificado el 25 oct 2026 en las docs oficiales y on-chain (`name`, `decimals`, `authorizationState`, dominio EIP-712):

| Red | Chain id | RPC público | Explorer | Tokens (decimales, dominio EIP-712) |
|---|---|---|---|---|
| Arbitrum Sepolia | 421614 | `https://sepolia-rollup.arbitrum.io/rpc` | sepolia.arbiscan.io | USDC `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` (6, "USD Coin"/"2"), USDG `0xFFC95faa3d63Cde504a05B567C600B78C0b41892` (6, "Global Dollar"/"1") |
| Robinhood Chain Testnet | 46630 | `https://rpc.testnet.chain.robinhood.com` | explorer.testnet.chain.robinhood.com | USDG `0x7E955252E15c84f5768B83c41a71F9eba181802F` (6, "Global Dollar"/"1") |
| Arc Testnet | 5042002 | `https://rpc.testnet.arc.io` | explorer.testnet.arc.io | USDC `0x3600000000000000000000000000000000000000` (6, "USDC"/"2") |
| Arbitrum One | 42161 | `https://arb1.arbitrum.io/rpc` | arbiscan.io | USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` (6, "USD Coin"/"2"), USDG `0x004B506865409877C9fA29bfb1ebA929984B9bbC` (6, "Global Dollar"/"1") |
| Robinhood Chain | 4663 | `https://rpc.mainnet.chain.robinhood.com` | robinhoodchain.blockscout.com | USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6, "Global Dollar"/"1") |
| Arc | 5042 | `https://rpc.mainnet.arc.io` | explorer.arc.io | USDC `0x3600000000000000000000000000000000000000` (6, "USDC"/"2") |

Fuentes: docs.arbitrum.io (chain info), docs.robinhood.com/chain/connecting y /contracts, docs.arc.io (rpc-endpoints y contract-addresses), docs.paxos.com (USDG on main networks). USDG no expone `version()`: la versión "1" se confirmó comparando su `DOMAIN_SEPARATOR` on-chain. Los RPC públicos tienen rate limit; para el deploy conviene un proveedor (Alchemy, QuickNode).

Las seis redes tienen Safe v1.4.1 desplegado (SafeL2 `0x29fcB43b…C762`, factory `0x4e1DCf7A…ec67`). Safe{Wallet} (app.safe.global) soporta Arbitrum, Robinhood Chain, Robinhood Testnet, Arc y Arc Testnet; **Arbitrum Sepolia no aparece** en su lista de redes.

## Qué tiene que preparar San

1. **Safe por red.** Lo más simple: un Safe con los mismos firmantes, umbral y `saltNonce` creado en Arbitrum One, Robinhood Chain y Arc, que queda con la misma dirección en las tres si se crea con la misma configuración desde la misma factory. Mínimo 2 de 3 firmantes, en dispositivos distintos. En testnet: Safe en Robinhood Testnet y Arc Testnet desde la app; en Arbitrum Sepolia, sin soporte en la app, sirve una EOA de prueba como owner (`ALLOW_EOA_OWNER=true`, solo testnet) o un Safe creado con el SDK.
2. **Un relayer por red**, EOA nueva (no la treasury actual), con gas nativo: algo de ETH en Arbitrum y Robinhood, USDC nativo en Arc (en Arc mainnet el USDC de gas se pide al contacto de Circle, según sus docs). Un pago cuesta ~150k a 190k gas.
3. **Guardian por red** (o la misma dirección en las seis): una llave que San pueda usar en minutos, por ejemplo una hardware wallet o un Safe 1 de N. Distinta del Safe owner, del fee recipient y de los relayers. Solo puede pausar; necesita algo de gas nativo para hacerlo.
4. **Fee recipient**: dirección fría distinta del Safe y de los relayers. Puede ser un segundo Safe. Tiene que poder recibir USDC y USDG (no bloqueada por el emisor).
5. **Deployer**: cualquier EOA con gas. Termina sin rol. Importarla como keystore: `cast wallet import peaje-deployer --interactive`. Nunca como texto en `.env`.
6. **API key de Etherscan** (API v2, una sola para todas las cadenas) para verificar en Arbiscan. Robinhood y Arc usan Blockscout, sin key.

## Orden de deploy

1. **Testnets, una por una**: arbitrum-sepolia, robinhood-testnet, arc-testnet. En cada una: dry run, deploy, verificación, y prueba en staging: un pago real por token a una wallet de negocio, un front-run a mano con `settleStray` desde el Safe, `pause`/`unpause` desde el Safe, y rotación de relayer.
2. **Congelar**: tag del commit, `forge build` limpio, guardar el hash del bytecode. Ese commit es el alcance de la revisión.
3. **Revisión externa** sobre ese commit (checklist abajo). Si hay cambios, se redeploya en testnets y se repite el paso 1.
4. **Las tres mainnets juntas**, mismo commit, el mismo día: arbitrum-one, robinhood-mainnet, arc-mainnet. Verificar, comparar el bytecode con el de testnet (`cast code` contra el artefacto), y un pago real chico (US$0,10) por token.
5. **Gateway**: recién ahí se cambian las direcciones en el env de Railway.
6. **v2**: sigue vivo en testnet mientras tenga saldos (`claimable`). El gateway mantiene el retiro de v2 hasta vaciarlo; después se retira.

### Comandos

Variables comunes (ejemplo Arbitrum Sepolia):

```bash
cd contracts
export NETWORK=arbitrum-sepolia
export ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
export OWNER=0x<Safe>  GUARDIAN=0x<pausa>  FEE_RECIPIENT=0x<frío>  RELAYERS=0x<relayer>
# opcionales: ACCEPTED_TOKENS=0x..,0x..  MAX_NETWORK_FEES=20000,20000  ALLOW_EOA_OWNER=true (solo testnet)
```

Dry run (simula contra la red, no manda nada; imprime dirección prevista, roles, tokens y topes):

```bash
forge script script/DeployPeajeSettlementV3.s.sol --rpc-url arbitrum_sepolia --sender 0x<deployer>
```

Deploy real (agrega `--broadcast`; con Ledger, `--ledger` en vez de `--account`):

```bash
forge script script/DeployPeajeSettlementV3.s.sol --rpc-url arbitrum_sepolia \
  --account peaje-deployer --sender 0x<deployer> --broadcast
```

`NETWORK` y alias de RPC por red: `arbitrum-sepolia`/`arbitrum_sepolia`, `robinhood-testnet`/`robinhood_testnet`, `arc-testnet`/`arc_testnet`, `arbitrum-one`/`arbitrum_one`, `robinhood-mainnet`/`robinhood_mainnet`, `arc-mainnet`/`arc_mainnet` (variables `*_RPC_URL` en `foundry.toml`). El script revierte si el chain id del RPC no corresponde a `NETWORK`, si el owner no tiene código en mainnet, si los roles se repiten, o si un token no tiene código, `authorizationState` o 6 decimales.

### Verificación

Argumentos del constructor (los mismos que imprimió el script):

```bash
ARGS=$(cast abi-encode "constructor(address,address,address,address[],address[],uint256[])" \
  $OWNER $GUARDIAN $FEE_RECIPIENT "[$RELAYERS]" "[0xToken1,0xToken2]" "[20000,20000]")
C=src/PeajeSettlementV3.sol:PeajeSettlementV3
```

| Red | Comando |
|---|---|
| Arbitrum Sepolia | `forge verify-contract <addr> $C --chain 421614 --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY --constructor-args $ARGS` |
| Arbitrum One | igual con `--chain 42161` |
| Robinhood Testnet | `forge verify-contract <addr> $C --chain 46630 --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/ --constructor-args $ARGS` |
| Robinhood Chain | `... --chain 4663 --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/ ...` |
| Arc Testnet | `... --chain 5042002 --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/ ...` |
| Arc | `... --chain 5042 --verifier blockscout --verifier-url https://explorer.arc.io/api/ ...` |

Alternativa en cualquier red: `--verifier sourcify` (Blockscout lee Sourcify). También se puede verificar en el mismo paso del deploy agregando `--verify` y los flags del verificador a `forge script`.

Chequeo después de verificar: `cast call <addr> "owner()(address)"`, `guardian()`, `feeRecipient()`, `isRelayer(<relayer>)`, `maxNetworkFee(<token>)` y `FEE_BPS()` (tiene que dar 200).

## Checklist de la revisión externa

**Alcance**: `contracts/src/PeajeSettlementV3.sol` y `contracts/src/interfaces/IEIP3009.sol` en el commit congelado. Dependencias: OpenZeppelin 5.4.0 (`Ownable2Step`, `Pausable`, `ReentrancyGuardTransient`, `SafeERC20`), solc 0.8.28, EVM cancun, optimizer 10.000 runs. Fuera de alcance: v2, gateway, tokens.

- [ ] El saldo del contrato vuelve al de antes en cada `settle`; no hay ninguna ruta que deje fondos ni que los saque fuera de `settle`/`settleStray`.
- [ ] El reparto: `net + fee + networkFee == value`, fee redondeando hacia abajo, merchant nunca recibe más de `value - fee - networkFee`.
- [ ] `FEE_BPS` no se puede cambiar por ninguna vía.
- [ ] Control de acceso: `settle` solo relayers; `pause` owner o guardian; `unpause`, admin y `settleStray` solo owner; `renounceOwnership` deshabilitado; transferencia de ownership en dos pasos.
- [ ] `settleStray`: no permite repartir dos veces el mismo `(token, from, nonce)`, ni sin autorización usada, ni más que el saldo, y sale exactamente `value`; ningún rol de Peaje puede ser el merchant.
- [ ] Reentrancy y orden de llamadas externas (`transferWithAuthorization`, `balanceOf`, `safeTransfer`) con tokens proxy (USDC FiatToken, USDG Paxos).
- [ ] Validaciones de merchant (cero, el contrato, el fee recipient, el owner, el guardian, un relayer), de fee recipient (cero, el contrato) y del tope de networkFee (como mucho 0,10 del token, según `decimals()`).
- [ ] `ReentrancyGuardTransient` en las seis redes (TSTORE probado vía `eth_call` en las seis).
- [ ] Riesgos aceptados (sección anterior): merchant y networkFee elegidos por el relayer, blacklists, front-run, el owner rutea excedentes y donaciones, nonces de `settle` sin registrar.
- [ ] Que el script de deploy no deje roles al deployer y que los argumentos del constructor coincidan con lo verificado.

## Cambios en el gateway (próximo milestone)

1. **ABI** (`apps/gateway/src/settlement.ts`): `settle` igual. Sacar `withdrawWithSignature`, `claimable` y `nonces` del ABI de v3. Evento nuevo (ver arriba): `resolveSettlementPayer` tiene que parsear el de v3 y, para transacciones viejas, el de v2. ABI completo en `contracts/out/PeajeSettlementV3.sol/PeajeSettlementV3.json` después de `forge build`.
2. **Merchant**: pasar la wallet de cobro del negocio (la del dueño, de la migración de Privy), no la custodiada. El fallback `contexto?.merchant ?? relayer.address` hay que sacarlo: con v3 le mandaría el 98% a la llave del relayer. Si el merchant es el fee recipient, el contrato revierte.
3. **Cobros de planes**: van solo por Paddle (decisión de San), así que no pasan por el contrato. El gateway no debe llamar `settle` sin un negocio; en v3 el fee recipient no puede ser merchant.
4. **Llave del relayer**: nueva variable (por ejemplo `RELAYER_PRIVATE_KEY`), distinta de `TREASURY_PRIVATE_KEY`. `relayTokenTransfer` y `sendTreasuryPayout` siguen con la treasury.
5. **Saldos y retiros**: los rieles de contrato v3 pasan a comportarse como `tempo-split`: `available` siempre 0, retiro rechazado con mensaje claro, el dashboard muestra "ya está en tu wallet". `claimableEnContrato` y `withdrawFromSettlement` quedan solo para v2. Lo mismo en `apps/dashboard/lib/saldos.ts` y `CLAIMABLE_ABI` de `packages/shared`.
6. **Reembolsos** cuando falla el origen: igual que `tempo-split`, no se pueden sacar del contrato (el neto ya está en la wallet del negocio).
7. **Front-run**: si `settle` revierte por autorización usada, consultar `authorizationState` y el saldo del contrato; si los fondos están ahí, registrar el pago como pendiente de `settleStray` y avisar (propuesta para el Safe).
8. **`costoRed.ts`**: `GAS_SETTLE = 180_000` con margen 1,2 (216k). Cubre el estado estable de v3 (~163k gas totales con intrínseco y calldata, después de los chequeos de roles de la auditoría) y el primer pago a una wallet que nunca tuvo el token (~203k).
9. **Subgraph**: ABI nuevo, handler de `PaymentSettled` leyendo `net` del evento, sin `Withdrawn`, nuevas direcciones y `startBlock`.

## Decisiones de San (25 oct 2026)

1. **Redondeo**: hacia abajo, a favor del negocio (igual que Tempo y v2). La diferencia con redondear hacia arriba es menos de una unidad (US$0,000001) por pago.
2. **Topes de networkFee**: US$0,02 en Arbitrum One y Robinhood Chain, US$0,01 en Arc, y los mismos valores en sus testnets. Bajan de los US$0,05 de v2. Hoy un settle cuesta menos de US$0,01; si el gas sube por encima del tope, Peaje absorbe la diferencia.
3. **`settleWithPermit`**: fuera de v3. El gateway no lo usa (Tempo va con splits nativos) y las tres redes tienen EIP-3009. Si una red futura solo tiene EIP-2612, va en otra versión.
4. **Cobros de planes**: solo Paddle, sin cambios en el contrato.
5. **Chequeo de saldo final** (`BalanceNotRestored`): se queda. Cuesta ~2k a 3k gas por pago y hace que "el contrato nunca guarda nada" se compruebe on-chain en cada pago.
6. **Guardian**: agregado. Rol que solo puede `pause()`; el owner lo nombra y lo rota con `setGuardian`, y es el único que puede despausar.

## Resultados

- **Tests**: 85 en `test/v3/` (76 unitarios y fuzz, 8 de ellos del guardian; 6 invariantes en dos suites, 1 del script de deploy, 2 de gas; el de fork se corre con `FORK_GAS_RPC`). Todo el repo (29 oct 2026, con los arreglos de la auditoría y sus pruebas en `test/auditoria/`): 232, 231 pasan y 1 se salta sin fork (pasó corriéndolo contra Arbitrum Sepolia). Fuzz 1.000 corridas por test, con 6 y 18 decimales hasta mil millones de dólares; invariantes 256 × 64, con pausas hechas por el owner y por el guardian e intentos del guardian de despausar o reconfigurar (deben fallar siempre).
- **Cobertura** (`forge coverage --ir-minimum`): `PeajeSettlementV3.sol` 100% de ramas (18/18) y funciones (19/19), 96% de líneas (81/84). Las tres líneas "sin cubrir" (`_checkRelayer()`, `_pause()`, `_unpause()`) sí corren en los tests; es un artefacto de `--ir-minimum`, igual que en v2.
- **Slither 0.11.6** (`slither . --filter-paths "lib/|test/|script/"`): 0 hallazgos. Uno triageado inline: `reentrancy-balance` en `settle`, porque leer el saldo antes y después del cobro es justamente el control contra tokens que entregan menos; la reentrada está bloqueada. Fuera del filtro solo aparece `pragma` por las versiones de OpenZeppelin.
- **Gas** (`forge test --match-contract GasComparison --isolate`, ejecución sin los 21k intrínsecos, que son iguales en ambas versiones porque el calldata es el mismo):

| Token | Caso | v2 `settle` | v3 `settle` | Diferencia |
|---|---|---|---|---|
| USDC real (fork Arbitrum Sepolia) | primer pago a un merchant | 194.757 | 169.841 | −24.916 |
| USDC real | estado estable | 126.337 | 135.649 | +9.312 |
| USDG real (fork Arbitrum Sepolia) | primer pago | 194.200 | 175.594 | −18.606 |
| USDG real | estado estable | 125.800 | 136.594 | +10.794 |
| Mock | primer pago / estable | 179.391 / 110.991 | 154.576 / 120.376 | −24.815 / +9.385 |

Medido el 29 oct 2026 con los arreglos de la auditoría del 28 oct (los chequeos de roles suman unos 6k a 8k por `settle`), con `FORK_GAS_RPC=https://sepolia-rollup.arbitrum.io/rpc`. Queda dentro de lo previsto (~171k y ~137k) y de `GAS_SETTLE` del gateway (180k × 1,2). Un pago real en el contrato nuevo de Arbitrum Sepolia (primer pago a una wallet nueva, fee recipient con saldo) gastó 170.177 de gas en total: ver "Prueba de pago" abajo.

En v2 además cada retiro cuesta 91k a 94k de ejecución (`withdrawWithSignature`), que v3 elimina. En estado estable v3 cuesta 2% a 3% más por pago (dos transferencias en vez de dos escrituras de saldo, más el chequeo de saldo final) y nada en retiros. Deploy: 1,83M gas y 9.505 bytes de initcode desde la auditoría (antes 1,64M y 8.546; v2: 2,42M y 12.064). El guardian no cambia el gas de `settle`: solo agrega un slot que lee `pause()`.

## Deploys de testnet v3 (29 oct 2026)

Con los arreglos de la auditoría interna del 28 oct. Desplegados desde la treasury (`0x3715986D44f5d56BC6ae3E983D1928CEc37dE253`), que también queda como owner: EOA, solo testnet (`ALLOW_EOA_OWNER=true`), igual que en los deploys de v2. Mismo bytecode en las tres (7.410 bytes desplegados), `forge build` y `forge test` limpios antes del deploy (232 tests, 231 pasan, 1 se salta sin fork y pasó aparte con fork), simulación del script en las tres antes de enviar.

| Red | Contrato | Tx de deploy | Bloque | Gas |
|---|---|---|---|---|
| Arbitrum Sepolia (421614) | [`0xcd29503DEcd337Fe005ca07d1B0343AEE05CdF42`](https://sepolia.arbiscan.io/address/0xcd29503DEcd337Fe005ca07d1B0343AEE05CdF42) | [`0x3c8d5a15…c32ca`](https://sepolia.arbiscan.io/tx/0x3c8d5a15adceabc484c34eec24ca4dbd2f52dcb1437e9cffcb5d7ef9ea3c32ca) | 324.155.911 | 1.892.230 (0,000038 ETH) |
| Robinhood Chain Testnet (46630) | [`0x3e0f648349432A5195e498D8D3b7Fa7d759752cC`](https://explorer.testnet.chain.robinhood.com/address/0x3e0f648349432A5195e498D8D3b7Fa7d759752cC) | [`0xfea49867…11ad2`](https://explorer.testnet.chain.robinhood.com/tx/0xfea498672d6a9b9599964ef4c30e6b6f81444b4f4aa815e15ea9cf809ac11ad2) | 145.040.355 | 1.832.289 (0,0000183 ETH) |
| Arc Testnet (5042002) | [`0x5a810d1317412A9635D0F84B74ff9F2DFbEc0E21`](https://explorer.testnet.arc.io/address/0x5a810d1317412A9635D0F84B74ff9F2DFbEc0E21) | [`0x5c08b834…0d00e`](https://explorer.testnet.arc.io/tx/0x5c08b8343998b3016caca41dc8eb79f9c5e7acbe09c0bc7a329730d296f0d00e) | 69.744.527 | 1.836.469 (0,0494 USDC) |

Los del 25 oct, sin los arreglos (`0xFFE62DAc…95A7` en Arbitrum Sepolia, `0x699F634b…c754` en Robinhood Testnet, `0x39F31599…7417` en Arc Testnet), quedan en la cadena sin uso: el gateway deja de apuntarles cuando Railway tiene las direcciones nuevas. No guardan saldos, así que no hay nada que sacar de ellos.

Roles (los mismos en las tres redes; llaves en el `.env` raíz, gitignoreado):

| Rol | Dirección | Variable en `.env` |
|---|---|---|
| owner | `0x3715986D44f5d56BC6ae3E983D1928CEc37dE253` (treasury) | `TREASURY_ADDRESS` |
| guardian | `0x9D1F2167335B054a1C583555a8fEaEB47820174D` | `PEAJE_V3_GUARDIAN_ADDRESS` |
| relayer | `0x3D19a41c91855CdAB30A19553845621Fb0Bbfdb6` | `RELAYER_ADDRESS` |
| fee recipient | `0xD7EEf925c0F6Bc6dC6963499d8444cC2E0d9aD4f` | `PEAJE_V3_FEE_RECIPIENT_ADDRESS` |

Tokens y topes: Arbitrum Sepolia USDC `0x75faf114…AA4d` y USDG `0xFFC95faa…1892` con 20.000 (US$0,02); Robinhood Testnet USDG `0x7E955252…802F` con 20.000; Arc Testnet USDC `0x3600…0000` con 10.000 (US$0,01).

Verificación: Sourcify `exact_match` (creación y runtime) en las tres, con `--verify --verifier sourcify` en el mismo deploy: [421614](https://repo.sourcify.dev/421614/0xcd29503DEcd337Fe005ca07d1B0343AEE05CdF42), [46630](https://repo.sourcify.dev/46630/0x3e0f648349432A5195e498D8D3b7Fa7d759752cC), [5042002](https://repo.sourcify.dev/5042002/0x5a810d1317412A9635D0F84B74ff9F2DFbEc0E21). Pendiente (igual que con los del 25 oct, no se reintentó):

- Arbiscan: no hay `ETHERSCAN_API_KEY` en el `.env`; con la key, el comando de la tabla de verificación de arriba.
- Blockscout de Robinhood Testnet y de Arc Testnet: responden `Fail - Unable to verify` con `forge verify-contract --verifier blockscout`, con standard JSON y con código aplanado por la API v2, aunque el bytecode que indexan es idéntico al del artefacto y v2 sí verificó ahí con la misma configuración. Tampoco toman la verificación de Sourcify por ahora. Reintentar más adelante o desde la UI del explorer.

Chequeo on-chain con `cast call` en las tres: `owner()` = treasury, `guardian()`, `feeRecipient()`, `isRelayer(relayer)` = true, `isRelayer(treasury)` = false, `isAcceptedToken` y `maxNetworkFee` por token según la tabla, `FEE_BPS()` = 200 y `paused()` = false. En Arbitrum Sepolia además `quote(1000000, 20000)` = (960.400, 19.600).

**Prueba de pago** (29 oct, Arbitrum Sepolia, sin pasar por el gateway): el agente comprador (`0x96d6…2653`) firmó un `TransferWithAuthorization` de 50.000 (US$0,05) de USDC al contrato y el relayer llamó `settle` con networkFee 8.000 hacia una wallet nueva (`0xe43e…dBce`). Tx [`0x940e69b0…5a6`](https://sepolia.arbiscan.io/tx/0x940e69b02735694514e13ca4bf5abfa5d9dc479d51a7eba4852df64c52cb15a6), 170.177 de gas. El negocio recibió 41.160 (98% de 42.000), el fee recipient 8.840 (840 de fee más los 8.000 de red) y el contrato quedó en 0.

Gas del relayer (desde la treasury, alcanza para unos 20 `settle` con margen de 2x a 3x):

| Red | Fondeo | Tx | Treasury después |
|---|---|---|---|
| Arbitrum Sepolia | 0,00015 ETH | [`0xf5859baa…e8102`](https://sepolia.arbiscan.io/tx/0xf5859baa42a95a66e27547ee4a3049263b451350ae0e7af1dae9eb5ecdbe8102) | 0,000656 ETH |
| Robinhood Testnet | 0,0001 ETH | [`0x184125f1…1411f`](https://explorer.testnet.chain.robinhood.com/tx/0x184125f196927a47824ee24af8210e3cdf73ab83510da95df10d170ccdb1411f) | 0,009838 ETH |
| Arc Testnet | 0,3 USDC | [`0x5313bf40…2a8f5`](https://explorer.testnet.arc.io/tx/0x5313bf40ad3a601d47492824ae7e774354677781a9a7f7aa2c9a95aa3ed2a8f5) | 14,097 USDC |

El guardian y el fee recipient quedan sin gas: el guardian necesita algo de gas nativo antes de poder llamar `pause()`. Direcciones del gateway en el `.env` raíz: `PEAJE_SETTLEMENT_V3_ARBITRUM_SEPOLIA`, `PEAJE_SETTLEMENT_V3_ROBINHOOD_TESTNET`, `PEAJE_SETTLEMENT_V3_ARC_TESTNET` y `RELAYER_PRIVATE_KEY`; el 29 oct el `.env` ya tiene las del redeploy y Railway tiene que recibir las mismas tres. Saldo del relayer el 29 oct, después de la prueba de pago: 0,000147 ETH en Arbitrum Sepolia, 0,0001 ETH en Robinhood Testnet y 0,3 USDC en Arc Testnet.
