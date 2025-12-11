export const API_BASE_URL = typeof window !== 'undefined' 
  ? `http://${window.location.hostname}:8000` 
  : 'http://localhost:8000';

export const WS_BASE_URL = typeof window !== 'undefined'
  ? `ws://${window.location.hostname}:8000`
  : 'ws://localhost:8000';
