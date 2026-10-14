import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { sha256, makeLock, checkPin, checkRecovery, newRecoveryCode, checkMaster, MASTER_RECOVERY_HASH } from '../src/data/pin.js'

test('sha256 matches the standard vectors and node:crypto', () => {
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  // multi-block input and non-ASCII (Greek) text
  for (const s of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'Γιώργος 1234 · ζώνη']) {
    assert.equal(sha256(s), createHash('sha256').update(s, 'utf8').digest('hex'))
  }
})

test('PIN and recovery code', () => {
  const code = newRecoveryCode()
  assert.match(code, /^\d{4}-\d{4}-\d{4}$/)
  const lock = makeLock('2580', code, false)
  assert.equal(JSON.stringify(lock).includes('2580'), false)   // never stored in clear
  assert.ok(checkPin(lock, '2580'))
  assert.ok(!checkPin(lock, '0000'))
  assert.ok(checkRecovery(lock, code))
  assert.ok(checkRecovery(lock, code.replace(/-/g, ' ')))      // typed without dashes
  assert.ok(!checkRecovery(lock, '0000-0000-0000'))
  assert.ok(!checkPin(null, '2580'))
})

test('master recovery code: only its hash is in the code, and it is long', () => {
  assert.match(MASTER_RECOVERY_HASH, /^[0-9a-f]{64}$/)
  // same scheme with a throwaway code
  const code = '1111-2222-3333-4444-5555'
  const hash = createHash('sha256').update('dojo-patras-master:11112222333344445555').digest('hex')
  assert.ok(checkMaster(code, hash))
  assert.ok(checkMaster('11112222333344445555', hash))
  assert.ok(!checkMaster('1111-2222-3333-4444-5556', hash))
  assert.ok(!checkMaster('0000-0000-0000', MASTER_RECOVERY_HASH))
})
