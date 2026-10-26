// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {MockStablecoin} from "../mocks/MockStablecoinV3.sol";

/// @dev Drives the contract with two tokens (6 and 18 decimals), several merchants, valid and
///      invalid settlements, pauses, fee recipient rotations and, when `withStrays` is on,
///      front-run authorizations routed later with `settleStray` plus plain donations.
///      With `fail_on_revert = false`, per-call checks are counted in ghost variables
///      instead of asserted, and the invariants assert the counters stay at zero.
contract SettlementV3Handler is Test {
    PeajeSettlementV3 internal settlement;
    MockStablecoin[2] internal tokens;
    address internal owner;
    address internal relayer;
    bool internal withStrays;

    uint256 internal constant AGENT_KEY = 0xA11CE;
    address internal agent = vm.addr(AGENT_KEY);
    address[] internal merchants;
    address[] public feeRecipients;
    uint256 internal nonceCounter;

    struct Stray {
        uint8 token;
        uint256 value;
        bytes32 nonce;
    }

    Stray[] internal strays;

    // ghosts, per token index
    uint256[2] public ghostGross;
    uint256[2] public ghostNet;
    uint256[2] public ghostToFeeRecipients;
    uint256[2] public ghostStrayOutstanding;
    uint256[2] public ghostDonated;
    uint256 public splitViolations;
    uint256 public unexpectedSuccesses;
    uint256 public settled;

    constructor(PeajeSettlementV3 s, MockStablecoin[2] memory t, address owner_, address relayer_, bool withStrays_) {
        settlement = s;
        tokens = t;
        owner = owner_;
        relayer = relayer_;
        withStrays = withStrays_;
        merchants.push(makeAddr("merchantA"));
        merchants.push(makeAddr("merchantB"));
        merchants.push(makeAddr("merchantC"));
        feeRecipients.push(s.feeRecipient());
    }

    function feeRecipientCount() external view returns (uint256) {
        return feeRecipients.length;
    }

    function merchantCount() external view returns (uint256) {
        return merchants.length;
    }

    function merchantAt(uint256 i) external view returns (address) {
        return merchants[i];
    }

    function _auth(MockStablecoin token, uint256 value, bytes32 nonce)
        internal
        view
        returns (PeajeSettlementV3.Authorization memory a)
    {
        a.from = agent;
        a.value = value;
        a.validBefore = block.timestamp + 300;
        a.nonce = nonce;
        bytes32 structHash = keccak256(
            abi.encode(
                token.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(), agent, address(settlement), value, 0, a.validBefore, nonce
            )
        );
        (a.v, a.r, a.s) =
            vm.sign(AGENT_KEY, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
    }

    function _amounts(uint8 t, uint256 value, uint256 networkFee) internal view returns (uint256, uint256) {
        uint256 cap = settlement.maxNetworkFee(address(tokens[t]));
        networkFee = bound(networkFee, 0, cap);
        uint256 unit = 10 ** tokens[t].decimals();
        value = bound(value, networkFee + 1, 1_000_000 * unit);
        return (value, networkFee);
    }

    function _recordSplit(uint8 t, uint256 value, uint256 networkFee, uint256 net) internal {
        uint256 price = value - networkFee;
        uint256 fee = value - networkFee - net;
        if (fee != (price * 200) / 10_000 || net * 10_000 < price * 9_800) ++splitViolations;
        ghostGross[t] += value;
        ghostNet[t] += net;
        ghostToFeeRecipients[t] += fee + networkFee;
        ++settled;
    }

    function settle(uint8 tokenSeed, uint256 value, uint256 networkFee, uint256 merchantSeed) external {
        uint8 t = tokenSeed % 2;
        MockStablecoin token = tokens[t];
        (value, networkFee) = _amounts(t, value, networkFee);
        address merchant = merchants[merchantSeed % merchants.length];
        token.mint(agent, value);

        PeajeSettlementV3.Authorization memory a = _auth(token, value, bytes32(++nonceCounter));
        uint256 merchantBefore = token.balanceOf(merchant);
        vm.prank(relayer);
        try settlement.settle(address(token), merchant, a, networkFee) returns (uint256 net) {
            if (token.balanceOf(merchant) - merchantBefore != net) ++splitViolations;
            _recordSplit(t, value, networkFee, net);
        } catch {
            // Only a pause may stop a valid settlement.
            if (!settlement.paused()) ++splitViolations;
        }
    }

    /// Attacks that must always revert: replay, cap breach, fee recipient as merchant, stranger.
    function attack(uint8 tokenSeed, uint256 value, uint8 kind) external {
        uint8 t = tokenSeed % 2;
        MockStablecoin token = tokens[t];
        (value,) = _amounts(t, value, 0);
        token.mint(agent, value);
        PeajeSettlementV3.Authorization memory a = _auth(token, value, bytes32(++nonceCounter));
        address merchant = merchants[0];
        uint256 cap = settlement.maxNetworkFee(address(token));

        kind = kind % 4;
        address caller = relayer;
        uint256 networkFee;
        if (kind == 0) {
            // replay: settle once (if not paused), then again
            vm.prank(relayer);
            try settlement.settle(address(token), merchant, a, 0) returns (uint256 net) {
                _recordSplit(t, value, 0, net);
            } catch {}
        } else if (kind == 1) {
            networkFee = cap + 1;
            if (value <= networkFee) return;
        } else if (kind == 2) {
            merchant = settlement.feeRecipient();
        } else {
            caller = makeAddr("stranger");
        }

        vm.prank(caller);
        try settlement.settle(address(token), merchant, a, networkFee) {
            ++unexpectedSuccesses;
        } catch {}
    }

    /// Pauses through the owner or the guardian; only the owner unpauses. The guardian's attempts
    /// to unpause or reconfigure must always fail.
    function togglePause(bool viaGuardian) external {
        address guardian = settlement.guardian();
        if (settlement.paused()) {
            vm.prank(guardian);
            try settlement.unpause() {
                ++unexpectedSuccesses;
            } catch {}
            vm.prank(owner);
            settlement.unpause();
        } else {
            vm.prank(viaGuardian ? guardian : owner);
            settlement.pause();
        }
        vm.prank(guardian);
        try settlement.setFeeRecipient(guardian) {
            ++unexpectedSuccesses;
        } catch {}
    }

    function rotateFeeRecipient(uint256 seed) external {
        address next = makeAddr(string(abi.encode("feeRecipient", seed % 4)));
        vm.prank(owner);
        settlement.setFeeRecipient(next);
        for (uint256 i; i < feeRecipients.length; ++i) {
            if (feeRecipients[i] == next) return;
        }
        feeRecipients.push(next);
    }

    function frontRun(uint8 tokenSeed, uint256 value) external {
        if (!withStrays) return;
        uint8 t = tokenSeed % 2;
        MockStablecoin token = tokens[t];
        (value,) = _amounts(t, value, 0);
        token.mint(agent, value);
        bytes32 nonce = bytes32(++nonceCounter);
        PeajeSettlementV3.Authorization memory a = _auth(token, value, nonce);
        token.transferWithAuthorization(agent, address(settlement), value, 0, a.validBefore, nonce, a.v, a.r, a.s);
        strays.push(Stray(t, value, nonce));
        ghostStrayOutstanding[t] += value;
    }

    function settleStray(uint256 index, uint256 networkFee, uint256 merchantSeed) external {
        if (strays.length == 0) return;
        index = index % strays.length;
        Stray memory s = strays[index];
        MockStablecoin token = tokens[s.token];
        networkFee = bound(networkFee, 0, settlement.maxNetworkFee(address(token)));
        if (s.value <= networkFee) networkFee = 0;
        address merchant = merchants[merchantSeed % merchants.length];

        vm.prank(owner);
        uint256 net = settlement.settleStray(address(token), merchant, agent, s.value, s.nonce, networkFee);
        _recordSplit(s.token, s.value, networkFee, net);
        ghostStrayOutstanding[s.token] -= s.value;
        strays[index] = strays[strays.length - 1];
        strays.pop();

        // A second routing of the same nonce must fail.
        vm.prank(owner);
        try settlement.settleStray(address(token), merchant, agent, s.value, s.nonce, 0) {
            ++unexpectedSuccesses;
        } catch {}
    }

    function donate(uint8 tokenSeed, uint256 value) external {
        if (!withStrays) return;
        uint8 t = tokenSeed % 2;
        (value,) = _amounts(t, value, 0);
        tokens[t].mint(address(settlement), value);
        ghostDonated[t] += value;
    }
}

abstract contract SettlementV3InvariantBase is Test {
    PeajeSettlementV3 internal settlement;
    MockStablecoin[2] internal tokens;
    SettlementV3Handler internal handler;

    function _setUp(bool withStrays) internal {
        address owner = makeAddr("owner");
        address relayer = makeAddr("relayer");
        tokens[0] = new MockStablecoin("USD Coin", "2", 6);
        tokens[1] = new MockStablecoin("Wide Dollar", "1", 18);

        address[] memory relayers = new address[](1);
        relayers[0] = relayer;
        address[] memory list = new address[](2);
        list[0] = address(tokens[0]);
        list[1] = address(tokens[1]);
        uint256[] memory caps = new uint256[](2);
        caps[0] = 20_000;
        caps[1] = 0.02e18;
        settlement = new PeajeSettlementV3(owner, makeAddr("guardian"), makeAddr("feeRecipient"), relayers, list, caps);

        handler = new SettlementV3Handler(settlement, tokens, owner, relayer, withStrays);
        targetContract(address(handler));
        if (!withStrays) {
            bytes4[] memory selectors = new bytes4[](4);
            selectors[0] = SettlementV3Handler.settle.selector;
            selectors[1] = SettlementV3Handler.attack.selector;
            selectors[2] = SettlementV3Handler.togglePause.selector;
            selectors[3] = SettlementV3Handler.rotateFeeRecipient.selector;
            targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        }
    }

    function _feeRecipientsTotal(uint8 t) internal view returns (uint256 sum) {
        for (uint256 i; i < handler.feeRecipientCount(); ++i) {
            sum += tokens[t].balanceOf(handler.feeRecipients(i));
        }
    }

    function _merchantsTotal(uint8 t) internal view returns (uint256 sum) {
        for (uint256 i; i < handler.merchantCount(); ++i) {
            sum += tokens[t].balanceOf(handler.merchantAt(i));
        }
    }

    function invariant_EverySplitIsExact() public view {
        assertEq(handler.splitViolations(), 0);
        assertEq(handler.unexpectedSuccesses(), 0);
    }

    function invariant_MoneyOnlyGoesToMerchantsAndFeeRecipients() public view {
        for (uint8 t; t < 2; ++t) {
            assertEq(_merchantsTotal(t), handler.ghostNet(t));
            assertEq(_feeRecipientsTotal(t), handler.ghostToFeeRecipients(t));
            assertEq(handler.ghostNet(t) + handler.ghostToFeeRecipients(t), handler.ghostGross(t));
        }
    }
}

/// Without front-runs or donations the contract must end every call with a zero balance.
contract PeajeSettlementV3StrictInvariantTest is SettlementV3InvariantBase {
    function setUp() public {
        _setUp(false);
    }

    function invariant_BalanceIsAlwaysZero() public view {
        assertEq(tokens[0].balanceOf(address(settlement)), 0);
        assertEq(tokens[1].balanceOf(address(settlement)), 0);
    }
}

/// With front-runs and donations, the balance is exactly what nobody has routed yet: settle
/// never touches it, settleStray only moves the stray it names.
contract PeajeSettlementV3StrayInvariantTest is SettlementV3InvariantBase {
    function setUp() public {
        _setUp(true);
    }

    function invariant_BalanceIsOnlyUnroutedStraysAndDonations() public view {
        for (uint8 t; t < 2; ++t) {
            assertEq(
                tokens[t].balanceOf(address(settlement)), handler.ghostStrayOutstanding(t) + handler.ghostDonated(t)
            );
        }
    }
}
