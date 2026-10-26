// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PeajeSettlement} from "../../src/PeajeSettlement.sol";
import {PeajeSettlementV3} from "../../src/PeajeSettlementV3.sol";
import {MockStablecoin} from "../mocks/MockStablecoinV3.sol";

/// @dev v2 vs v3 gas for one payment. Run with `--isolate` so every call is its own transaction
///      (cold storage, like on-chain):
///        forge test --match-contract GasComparison --isolate -vv
///      With FORK_GAS_RPC set to an Arbitrum Sepolia RPC, the same is measured against the real
///      USDC (FiatToken proxy) and USDG deployed there, on a local fork. Nothing is broadcast.
///      Numbers are execution gas of the call (`vm.lastCallGas`), without the 21k intrinsic and
///      calldata cost, which are the same for both versions because `settle` keeps its ABI.
contract GasComparison is Test {
    uint256 internal constant AGENT_KEY = 0xA11CE;
    address internal agent = vm.addr(AGENT_KEY);
    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal guardian = makeAddr("guardian");
    address internal treasury = makeAddr("feeRecipient");
    uint256 internal merchantKey = 0xB0B;
    address internal merchant = vm.addr(merchantKey);

    PeajeSettlement internal v2;
    PeajeSettlementV3 internal v3;
    IERC20 internal token;
    bytes32 internal domainSeparator;

    bytes32 internal constant TWA_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    function _deploy(address token_) internal {
        token = IERC20(token_);
        v2 = new PeajeSettlement(owner, treasury, 200);
        vm.startPrank(owner);
        v2.setRelayer(relayer, true);
        v2.setAcceptedToken(token_, true, 50_000);
        vm.stopPrank();

        address[] memory relayers = new address[](1);
        relayers[0] = relayer;
        address[] memory tokens = new address[](1);
        tokens[0] = token_;
        uint256[] memory caps = new uint256[](1);
        caps[0] = 50_000;
        v3 = new PeajeSettlementV3(owner, guardian, treasury, relayers, tokens, caps);
    }

    function _auth(address to, uint256 value, bytes32 nonce)
        internal
        view
        returns (uint256 validBefore, uint8 v, bytes32 r, bytes32 s)
    {
        validBefore = block.timestamp + 300;
        bytes32 structHash = keccak256(abi.encode(TWA_TYPEHASH, agent, to, value, 0, validBefore, nonce));
        (v, r, s) = vm.sign(AGENT_KEY, keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
    }

    function _settleV2(uint256 value, uint256 networkFee, bytes32 nonce) internal returns (uint256) {
        (uint256 validBefore, uint8 v, bytes32 r, bytes32 s) = _auth(address(v2), value, nonce);
        PeajeSettlement.Authorization memory a =
            PeajeSettlement.Authorization(agent, value, 0, validBefore, nonce, v, r, s);
        vm.prank(relayer);
        v2.settle(address(token), merchant, a, networkFee);
        return vm.lastCallGas().gasTotalUsed;
    }

    function _settleV3(uint256 value, uint256 networkFee, bytes32 nonce) internal returns (uint256) {
        (uint256 validBefore, uint8 v, bytes32 r, bytes32 s) = _auth(address(v3), value, nonce);
        PeajeSettlementV3.Authorization memory a =
            PeajeSettlementV3.Authorization(agent, value, 0, validBefore, nonce, v, r, s);
        vm.prank(relayer);
        v3.settle(address(token), merchant, a, networkFee);
        return vm.lastCallGas().gasTotalUsed;
    }

    function _withdrawV2() internal returns (uint256) {
        uint256 amount = v2.claimable(address(token), merchant);
        uint256 deadline = block.timestamp + 600;
        bytes32 structHash = keccak256(
            abi.encode(
                v2.WITHDRAW_TYPEHASH(), address(token), merchant, amount, merchant, v2.nonces(merchant), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(merchantKey, keccak256(abi.encodePacked("\x19\x01", v2.DOMAIN_SEPARATOR(), structHash)));
        vm.prank(relayer);
        v2.withdrawWithSignature(address(token), merchant, amount, merchant, deadline, abi.encodePacked(r, s, v));
        return vm.lastCallGas().gasTotalUsed;
    }

    function _report(string memory label) internal {
        // First payment: merchant and fee recipient hold nothing yet (zero -> non-zero writes).
        uint256 v2First = _settleV2(12_000, 2_000, "v2-1");
        uint256 v3First = _settleV3(12_000, 2_000, "v3-1");
        // Steady state: both already hold a balance (non-zero -> non-zero writes).
        uint256 v2Next = _settleV2(12_000, 2_000, "v2-2");
        uint256 v3Next = _settleV3(12_000, 2_000, "v3-2");
        uint256 v2Withdraw = _withdrawV2();

        console.log(label);
        console.log("  settle, first payment     v2:", v2First, " v3:", v3First);
        console.log("  settle, steady state      v2:", v2Next, " v3:", v3Next);
        console.log("  v2 withdrawWithSignature (once per payout, not per payment):", v2Withdraw);
        assertEq(token.balanceOf(address(v3)), 0);
    }

    function test_Gas_MockUsdc() public {
        vm.warp(1_000_000);
        MockStablecoin mock = new MockStablecoin("USD Coin", "2", 6);
        domainSeparator = mock.DOMAIN_SEPARATOR();
        mock.mint(agent, 1e6);
        _deploy(address(mock));
        _report("Mock EIP-3009 token (plain ERC20 storage)");
    }

    function test_Gas_ForkArbitrumSepolia() public {
        string memory rpc = vm.envOr("FORK_GAS_RPC", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        // Funds for the payer come from the v2 contract's own balance, on the local fork only.
        address v2Live = 0x36F9aEBeBce767A1FEE25Fa90F9bF13137E61231;
        address[2] memory real =
            [0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d, 0xFFC95faa3d63Cde504a05B567C600B78C0b41892];
        string[2] memory labels = ["Arbitrum Sepolia USDC (FiatToken proxy)", "Arbitrum Sepolia USDG (Paxos proxy)"];
        for (uint256 i; i < 2; ++i) {
            vm.prank(v2Live);
            IERC20(real[i]).transfer(agent, 4 * 12_000);
            (, bytes memory ds) = real[i].staticcall(abi.encodeWithSignature("DOMAIN_SEPARATOR()"));
            domainSeparator = abi.decode(ds, (bytes32));
            merchant = vm.addr(uint256(keccak256(abi.encode("merchant", i))));
            merchantKey = uint256(keccak256(abi.encode("merchant", i)));
            treasury = makeAddr(string(abi.encode("feeRecipient", i)));
            _deploy(real[i]);
            _report(labels[i]);
        }
    }
}
