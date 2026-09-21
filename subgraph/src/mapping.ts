import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { PaymentSettled, Withdrawn } from "../generated/PeajeSettlement/PeajeSettlement"
import { Account, Payment, Withdrawal } from "../generated/schema"

function loadAccount(address: Bytes): Account {
  let account = Account.load(address)
  if (account == null) {
    account = new Account(address)
    account.totalReceived = BigInt.zero()
    account.totalFees = BigInt.zero()
    account.totalWithdrawn = BigInt.zero()
    account.paymentCount = 0
  }
  return account
}

export function handlePaymentSettled(event: PaymentSettled): void {
  const net = event.params.amount.minus(event.params.fee)

  const merchant = loadAccount(event.params.merchant)
  merchant.totalReceived = merchant.totalReceived.plus(net)
  merchant.totalFees = merchant.totalFees.plus(event.params.fee)
  merchant.paymentCount = merchant.paymentCount + 1
  merchant.save()

  const payment = new Payment(event.transaction.hash.concatI32(event.logIndex.toI32()))
  payment.nonce = event.params.nonce
  payment.token = event.params.token
  payment.merchant = merchant.id
  payment.payer = event.params.payer
  payment.amount = event.params.amount
  payment.fee = event.params.fee
  payment.net = net
  payment.blockNumber = event.block.number
  payment.timestamp = event.block.timestamp
  payment.txHash = event.transaction.hash
  payment.save()
}

export function handleWithdrawn(event: Withdrawn): void {
  const account = loadAccount(event.params.account)
  account.totalWithdrawn = account.totalWithdrawn.plus(event.params.amount)
  account.save()

  const withdrawal = new Withdrawal(event.transaction.hash.concatI32(event.logIndex.toI32()))
  withdrawal.token = event.params.token
  withdrawal.account = account.id
  withdrawal.to = event.params.to
  withdrawal.amount = event.params.amount
  withdrawal.blockNumber = event.block.number
  withdrawal.timestamp = event.block.timestamp
  withdrawal.txHash = event.transaction.hash
  withdrawal.save()
}
