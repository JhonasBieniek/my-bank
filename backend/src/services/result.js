function ok(value) {
  return { ok: true, value };
}

function fail(error) {
  return { ok: false, error };
}

module.exports = { ok, fail };
