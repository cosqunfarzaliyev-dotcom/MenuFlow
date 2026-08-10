/**
 * Verifies customer order realtime filter matches table UUID, not table number.
 * Run: node scripts/verify-order-subscription.mjs
 */

function shouldReloadOrders(record, resolvedTable) {
  const recTableId = record?.table_id?.toString();
  const myTableId = resolvedTable?.id?.toString();
  return Boolean(recTableId && myTableId && recTableId === myTableId);
}

function oldShouldReloadOrders(record, tableId) {
  const recTable = record?.table_id ?? record?.table;
  return Boolean(recTable && recTable.toString() === tableId.toString());
}

const tableUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const tableNumber = '12';
const record = { table_id: tableUuid };
const resolvedTable = { id: tableUuid, table_number: tableNumber };

const oldMatches = oldShouldReloadOrders(record, tableNumber);
const newMatches = shouldReloadOrders(record, resolvedTable);
const newMissesOtherTable = !shouldReloadOrders(record, { id: 'other-uuid' });

let failed = false;

if (oldMatches) {
  console.error('FAIL: old logic incorrectly matched UUID to table number');
  failed = true;
}

if (!newMatches) {
  console.error('FAIL: fixed logic should reload when table UUID matches');
  failed = true;
}

if (!newMissesOtherTable) {
  console.error('FAIL: fixed logic should ignore orders for other tables');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('PASS: order subscription filter matches table UUID correctly');
