import React from "react";
import styles from "./MentionList.module.css";

type User = {
  id: string;
  name: string;
};

type Props = {
  users: User[];
  onSelect: (userId: string) => void;
};

/**
 * メンションリストコンポーネント
 */
export const MentionList: React.FC<Props> = ({ users, onSelect }) => {
  if (users.length === 0) return null;

  return (
    <div className={styles.container}>
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => onSelect(u.id)}
          className={styles.userButton}
        >
          <div className={styles.avatar}>
            {u.id[0].toUpperCase()}
          </div>
          <span className={styles.name}>{u.name}</span>
        </button>
      ))}
    </div>
  );
};

