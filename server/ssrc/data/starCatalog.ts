export type StarCategory = "putty" | "cloth";

export type StarItem = {
    id: string;
    category: StarCategory;
    label: string;
    points: number;
};

export const STAR_CATALOG: StarItem[] = [
    // --- パテ作業 (Max 50点 / 14項目) ---
    { id: "p1", category: "putty", label: "材料計量の正確さ", points: 1 },
    { id: "p2", category: "putty", label: "道具準備・清掃", points: 1 },
    { id: "p3", category: "putty", label: "安全・衛生管理", points: 1 },
    { id: "p4", category: "putty", label: "パテ練り精度", points: 2 },
    { id: "p5", category: "putty", label: "下パテ塗り厚管理", points: 3 },
    { id: "p6", category: "putty", label: "サンダー削りの均一性", points: 6 },
    { id: "p7", category: "putty", label: "粉塵管理", points: 2 },
    { id: "p8", category: "putty", label: "隣接面への配慮", points: 2 },
    { id: "p9", category: "putty", label: "クラック補修", points: 3 },
    { id: "p10", category: "putty", label: "下パテフラットボックス", points: 4 },
    { id: "p11", category: "putty", label: "上パテ仕上げ品質", points: 6 },
    { id: "p12", category: "putty", label: "上パテフラットボックス施工", points: 6 },
    { id: "p13", category: "putty", label: "曲面・特殊部位対応", points: 5 },
    { id: "p14", category: "putty", label: "作業速度（300㎡以上）", points: 8 },

    // --- クロス施工 (Max 120点 / 15項目) ---
    { id: "c1", category: "cloth", label: "糊付け", points: 2 },
    { id: "c2", category: "cloth", label: "道具管理（常に即使用状態）", points: 2 },
    { id: "c3", category: "cloth", label: "平場の施工（厚ベラ捌き等）", points: 4 },
    { id: "c4", category: "cloth", label: "天井貼り（6畳以上）", points: 6 },
    { id: "c5", category: "cloth", label: "ジョイント処理（突き付け/重ね切り）", points: 6 },
    { id: "c6", category: "cloth", label: "入隅・出隅納まり", points: 3 },
    { id: "c7", category: "cloth", label: "施工不能箇所なし", points: 5 },
    { id: "c8", category: "cloth", label: "柄物クロスのリピート合わせ", points: 4 },
    { id: "c9", category: "cloth", label: "寸法取り（正確な割り出し）", points: 8 },
    { id: "c10", category: "cloth", label: "天井貼り（6m以上・アシスト無）", points: 10 },
    { id: "c11", category: "cloth", label: "一日50㎡以上 安定品質", points: 5 },
    { id: "c12", category: "cloth", label: "一日75㎡以上（洋間+α）", points: 10 },
    { id: "c13", category: "cloth", label: "一日100㎡以上（同日施工）", points: 25 },
    { id: "c14", category: "cloth", label: "3階建て現場を一人で完全施工", points: 20 },
    { id: "c15", category: "cloth", label: "すべての問題に対応可能", points: 10 },
];
