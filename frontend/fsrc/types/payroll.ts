export type PayrollWorker = {
  userId: string;
  name: string;
  days: number;
  starsTotal: number;
  peerCount: number;
  // luqoScore: number; // Deprecated
};

export type PayrollPreviewRequest = {
  profit: number;
  companyRate: number;
  p: number;
  peerUnit: number;
  workers: PayrollWorker[];
};
