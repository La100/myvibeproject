export type MeasurementSystem = 'metric' | 'imperial';

export const METRIC_LABOR_UNITS = [
  { value: 'm²', label: 'Square meters (m²)' },
  { value: 'm', label: 'Linear meters (m)' },
  { value: 'hours', label: 'Hours' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'm³', label: 'Cubic meters (m³)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'set', label: 'Complete set' },
  { value: 'room', label: 'Per room' },
  { value: 'item', label: 'Per item' },
] as const;

export const IMPERIAL_LABOR_UNITS = [
  { value: 'sq ft', label: 'Square feet (sq ft)' },
  { value: 'ft', label: 'Linear feet (ft)' },
  { value: 'hours', label: 'Hours' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'cu ft', label: 'Cubic feet (cu ft)' },
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'set', label: 'Complete set' },
  { value: 'room', label: 'Per room' },
  { value: 'item', label: 'Per item' },
] as const;

export function resolveMeasurementSystem(input?: string | null): MeasurementSystem {
  return input === 'imperial' ? 'imperial' : 'metric';
}

export function getLaborUnitsForMeasurementSystem(measurementSystem: MeasurementSystem) {
  return measurementSystem === 'imperial' ? IMPERIAL_LABOR_UNITS : METRIC_LABOR_UNITS;
}

export function getDefaultLaborUnit(measurementSystem: MeasurementSystem) {
  return measurementSystem === 'imperial' ? 'sq ft' : 'm²';
}
