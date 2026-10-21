import { describe, expect, it } from 'vitest';
import { readZip } from './zip';

// Archive fabriquée avec Python (zipfile, DEFLATE) : deux fichiers texte,
// dont un export.xml minimal. Elle n'est pas versionnée en binaire.
const ZIP_BASE64 =
  'UEsDBBQAAAAIAG9OVV2JXiCdgQAAAJEAAAAeAAAAYXBwbGVfaGVhbHRoX2V4cG9ydC9leHBvcnQueG1sTY3NCsIwEIRfJexVajdBRCRND3qoePLnBRa70kJMSrop9u3NUZjDfPAxY9vvx6uF0zzG0IDeIrTOdkxehjMJOXvnV0y9knXiBrrrLVOQUdZn4UvPpb9HTg/h6RRzEFAL+VzMnQE1CyUpKwUNmn2lsUKt8HBELFEbNIhQO1v//f0AUEsDBBQAAAAIAG9OVV1dCnbAFQAAABMAAAAiAAAAYXBwbGVfaGVhbHRoX2V4cG9ydC9leHBvcnRfY2RhLnhtbLNxzsnMy0xOzHHJTy7NTc0r0bcDAFBLAQIUAxQAAAAIAG9OVV2JXiCdgQAAAJEAAAAeAAAAAAAAAAAAAACAAQAAAABhcHBsZV9oZWFsdGhfZXhwb3J0L2V4cG9ydC54bWxQSwECFAMUAAAACABvTlVdXQp2wBUAAAATAAAAIgAAAAAAAAAAAAAAgAG9AAAAYXBwbGVfaGVhbHRoX2V4cG9ydC9leHBvcnRfY2RhLnhtbFBLBQYAAAAAAgACAJwAAAASAQAAAAA=';

function archive(): ArrayBuffer {
  const binary = atob(ZIP_BASE64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('readZip', () => {
  it('décompresse les fichiers texte utiles du répertoire central', async () => {
    const entries = await readZip(archive());

    expect(entries.map((entry) => entry.name)).toEqual(['apple_health_export/export.xml']);
    // Le carnet médical CDA est volontairement écarté : il peut peser des
    // gigaoctets et ne contient ni séance ni pas. Ce test le fige ici pour
    // qu'un futur changement de filtre ne le réintroduise pas par accident.
    expect(entries.some((entry) => /export_cda\\.xml$/i.test(entry.name))).toBe(false);
    expect(entries[0]?.text).toContain('<HealthData>');
    expect(entries[0]?.text).toContain('value="42"');
  });

  it('refuse un fichier qui n’est pas une archive', async () => {
    await expect(readZip(new ArrayBuffer(40))).rejects.toThrow(/ZIP/);
  });

  it('refuse une archive sans fichier texte utile', async () => {
    // Un ZIP vide valide : EOCD seul.
    const empty = new ArrayBuffer(22);
    const view = new DataView(empty);
    view.setUint32(0, 0x06054b50, true);
    await expect(readZip(empty)).rejects.toThrow(/XML|CSV/);
  });
});
