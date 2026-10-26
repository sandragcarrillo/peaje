import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { PaymentSettled, StraySettled } from "../generated/PeajeSettlementV3/PeajeSettlementV3"
import { Account, Payment } from "../generated/schema"

function loadAccount(address: Bytes): Account {
  let account = Account.load(address)
  if (account == null) {
    account = new Account(address)
    account.totalReceived = BigInt.zero()
    account.totalFees = BigInt.zero()
    account.totalNetworkFees = BigInt.zero()
    account.paymentCount = 0
  }
  return account
}

// v3 trae el neto en el evento: es exactamente lo que llegó a la wallet del negocio.
export function handlePaymentSettled(event: PaymentSettled): void {
  const merchant = loadAccount(event.params.merchant)
  merchant.totalReceived = merchant.totalReceived.plus(event.params.net)
  merchant.totalFees = merchant.totalFees.plus(event.params.fee)
  merchant.totalNetworkFees = merchant.totalNetworkFees.plus(event.params.networkFee)
  merchant.paymentCount = merchant.paymentCount + 1
  merchant.save()

  const payment = new Payment(event.transaction.hash.concatI32(event.logIndex.toI32()))
  payment.nonce = event.params.nonce
  payment.token = event.params.token
  payment.merchant = merchant.id
  payment.payer = event.params.payer
  payment.gross = event.params.gross
  payment.net = event.params.net
  payment.fee = event.params.fee
  payment.networkFee = event.params.networkFee
  payment.stray = false
  payment.blockNumber = event.block.number
  payment.timestamp = event.block.timestamp
  payment.txHash = event.transaction.hash
  payment.save()
}

// StraySettled va justo después de su PaymentSettled en la misma tx y no trae
// montos (no se cuenta dos veces): solo marca ese pago como repartido por el Safe.
export function handleStraySettled(event: StraySettled): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32() - 1)
  const payment = Payment.load(id)
  if (payment == null) return
  payment.stray = true
  payment.save()
}
