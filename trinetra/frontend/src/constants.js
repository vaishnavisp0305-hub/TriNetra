export const RISKS = ['Low', 'Medium', 'High', 'Critical']
export const RISK_COLOR = { Low: '#34d399', Medium: '#fbbf24', High: '#fb923c', Critical: '#f43f5e' }

export const UATD_CLASSES = [
  'cube', 'ball', 'cylinder', 'human body', 'tyre',
  'circle cage', 'square cage', 'metal bucket', 'plane', 'rov',
]

// Mirrors RISK_BY_CLASS in backend/app/detector.py. A starting assumption: tune with domain experts.
export const CLASS_RISK = {
  'human body': 'Critical',
  cylinder: 'High', plane: 'High', rov: 'High',
  cube: 'Medium', 'square cage': 'Medium', 'circle cage': 'Medium',
  'metal bucket': 'Low', tyre: 'Low', ball: 'Low',
}

// Human-readable names shown in the UI. Keys are the model's class strings.
export const DISPLAY_NAME = {
  cube: 'Cube-shaped object',
  ball: 'Spherical object (ball)',
  cylinder: 'Cylindrical object',
  'human body': 'Human body / diver',
  tyre: 'Tyre',
  'circle cage': 'Circular cage',
  'square cage': 'Square cage',
  'metal bucket': 'Metal bucket',
  plane: 'Plane (aircraft model)',
  rov: 'ROV (underwater vehicle)',
  'unclassified contact': 'Unclassified contact (needs operator label)',
}
export const displayName = (cls) => DISPLAY_NAME[cls] || cls
export const CLASS_OPTIONS = ['unclassified contact', ...UATD_CLASSES]
