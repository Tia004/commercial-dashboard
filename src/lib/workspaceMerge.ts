type RecordValue = Record<string, any>;
export interface WorkspaceData { opportunities: RecordValue[]; tasks: RecordValue[]; brands: string[]; salesReps: RecordValue[] }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
function mergeValue(base: any, local: any, remote: any): any {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    if ([...local, ...remote, ...(Array.isArray(base) ? base : [])].every((item) => object(item) && typeof item.id === 'string')) {
      const b = new Map((base || []).map((item: any) => [item.id, item]));
      const l = new Map(local.map((item) => [item.id, item]));
      const r = new Map(remote.map((item) => [item.id, item]));
      const ids = Array.from(new Set([...local.map((item) => item.id), ...remote.map((item) => item.id)]));
      return ids.flatMap((id) => {
        if (b.has(id) && !l.has(id)) return [];
        if (b.has(id) && !r.has(id) && equal(l.get(id), b.get(id))) return [];
        return [mergeValue(b.get(id), l.get(id), r.get(id))].filter(Boolean);
      });
    }
    return Array.from(new Set([...local, ...remote]));
  }
  if (object(local) && object(remote)) {
    const result: RecordValue = {};
    for (const key of Array.from(new Set([...Object.keys(local), ...Object.keys(remote)]))) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
      result[key] = mergeValue(base?.[key], local[key], remote[key]);
    }
    return result;
  }
  // Concurrent changes to the same field use the last explicit writer.
  return local === undefined ? remote : local;
}
export function mergeWorkspace(base: WorkspaceData, local: WorkspaceData, remote: WorkspaceData): WorkspaceData {
  return mergeValue(base, local, remote);
}
export function validWorkspace(data: any): data is WorkspaceData {
  return !!data && ['opportunities','tasks','brands','salesReps'].every((key) => Array.isArray(data[key]) && data[key].length <= 20000)
    && data.brands.every((item: unknown) => typeof item === 'string' && item.length <= 200)
    && data.opportunities.every((item: any) => object(item) && typeof item.id === 'string' && typeof item.company === 'string' && typeof item.name === 'string' && Array.isArray(item.history) && Number.isFinite(item.value) && item.value >= 0)
    && data.tasks.every((item: any) => object(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.date === 'string')
    && data.salesReps.every((item: any) => object(item) && typeof item.id === 'string' && typeof item.name === 'string');
}
export const emptyWorkspace = (): WorkspaceData => ({ opportunities: [], tasks: [], brands: [], salesReps: [] });
