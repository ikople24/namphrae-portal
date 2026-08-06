import { describe, expect, it } from 'vitest';
import { parseMapFile } from '@/lib/map-parse';

const FC =
  '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[98.8,18.7]},"properties":{"a":1}}]}';

describe('parseMapFile', () => {
  it('อ่าน .geojson ตรง ๆ ได้', () => {
    const r = parseMapFile(FC, 'zone.geojson');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.format).toBe('geojson');
      expect(r.fc.features).toHaveLength(1);
    }
  });

  it('แกะหัว var ของ qgis2web ออก', () => {
    const r = parseMapFile(`var json_Parcel_3 = ${FC};`, 'Parcel_3.js');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.format).toBe('qgis2web-js');
      expect(r.fc.features).toHaveLength(1);
    }
  });

  it('แกะหัวที่มีช่องว่าง/ไม่มีอัฒภาคปิดได้', () => {
    // qgis2web แต่ละรุ่นเว้นวรรคไม่เหมือนกัน และไฟล์จริงบางไฟล์ไม่มี ; ปิดท้าย
    const r = parseMapFile(`var   json_x=${FC}`, 'x.js');
    expect(r.ok).toBe(true);
  });

  it('.js ที่ไม่มีหัว var ถือว่าอ่านไม่ออก', () => {
    const r = parseMapFile(FC, 'x.js');
    expect(r.ok).toBe(false);
  });

  it('JSON พังคืน ok:false ไม่ throw', () => {
    const r = parseMapFile('{"type":', 'x.geojson');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('อ่านไฟล์ไม่ออก');
  });

  it('ปฏิเสธเมื่อไม่ใช่ FeatureCollection', () => {
    const r = parseMapFile(
      '{"type":"Feature","geometry":null,"properties":{}}',
      'x.geojson'
    );
    expect(r.ok).toBe(false);
  });

  it('ปฏิเสธ crs ที่ไม่ใช่ CRS84/EPSG:4326 แทนที่จะแปลงให้เงียบ ๆ', () => {
    const utm =
      '{"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:EPSG::32647"}},"features":[]}';
    const r = parseMapFile(utm, 'x.geojson');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('EPSG:4326');
  });

  it('ยอมรับ crs CRS84 ที่ qgis2web ใส่มา', () => {
    const ok =
      '{"type":"FeatureCollection","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"features":[]}';
    expect(parseMapFile(ok, 'x.geojson').ok).toBe(true);
  });
});
