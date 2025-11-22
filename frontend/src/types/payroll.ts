export type PayrollWorker = {
  name: string;
  days: number;
  starsTotal: number;
  luqoScore: number;
};

export type PayrollPreviewRequest = {
  profit: number;
  companyRate: number;
  p: number;
  workers: PayrollWorker[];
};
