export type PersonalHistoryRow = {
  month: string;
  lu: number;
  q: number;
  o: number;
  reward: number;
};

export const personalHistoryByUser: Record<string, PersonalHistoryRow[]> = {
  yoshino: [{ month: "2025-10", lu: 85, q: 70, o: 90, reward: 75 }],
  hamanaka: [{ month: "2025-10", lu: 80, q: 85, o: 70, reward: 90 }],
  jay: [{ month: "2025-10", lu: 85, q: 75, o: 80, reward: 80 }],
  teru: [{ month: "2025-10", lu: 80, q: 80, o: 70, reward: 78 }],
};

export function getPersonalHistory(userId: string): PersonalHistoryRow[] {
  return personalHistoryByUser[userId] ?? [];
}
