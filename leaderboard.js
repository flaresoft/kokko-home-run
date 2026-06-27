// 꼬꼬의 귀가길 — 온라인 리더보드 (Firebase Firestore)
// 게임(game.js)과 큰화면(leaderboard.html)이 공유하는 모듈.
// window.KokkoLB 로 submitScore / subscribeTop 을 노출한다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzCtkqEEcx3rh9OkSeeWSSj68Spwptlkg",
  authDomain: "kkokko-home-run.firebaseapp.com",
  projectId: "kkokko-home-run",
  storageBucket: "kkokko-home-run.firebasestorage.app",
  messagingSenderId: "778590081527",
  appId: "1:778590081527:web:dbee119eaeacd472ac9ef2",
};

// 단일 정렬키 트릭:
//  - 완주자: FINISHER_BASE + (TIME_CAP_MS - 걸린시간) → 항상 미완주자보다 위, 빠를수록 높음
//  - 미완주자: 이동 거리(0~1650)
// 덕분에 orderBy('rankScore','desc') 한 번으로 전체 순위가 정렬된다.
const FINISHER_BASE = 1000000;
const TIME_CAP_MS = 100000;
const FETCH_LIMIT = 100; // 상위 100건만 받아 닉네임 중복 제거 후 표시

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scoresCol = collection(db, "scores"); // 공개 읽기 — 닉네임/점수만 (연락처 없음)
const contactsCol = collection(db, "contacts"); // 쓰기 전용 — 연락처는 콘솔에서만 열람

function computeRankScore({ finished, elapsedMs, distance }) {
  if (finished) {
    return FINISHER_BASE + (TIME_CAP_MS - Math.round(elapsedMs));
  }
  return Math.max(0, Math.round(distance));
}

function localDayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function submitScore(entry) {
  const rankScore = computeRankScore(entry);
  const nickname = String(entry.nickname || "").slice(0, 16);
  const contact = String(entry.contact || "").slice(0, 40);
  const day = localDayStr();

  // 공개 순위표용 문서 — 연락처는 넣지 않는다(공개 읽기이므로).
  await addDoc(scoresCol, {
    nickname,
    finished: !!entry.finished,
    elapsedMs: Math.round(entry.elapsedMs),
    distance: Math.round(entry.distance),
    rankScore,
    day,
    createdAt: serverTimestamp(),
  });

  // 연락처는 별도 컬렉션(읽기 불가)에 보관 — 당첨자 안내용, 콘솔에서만 열람.
  if (contact) {
    await addDoc(contactsCol, {
      nickname,
      contact,
      rankScore,
      day,
      createdAt: serverTimestamp(),
    });
  }

  return { rankScore };
}

// 같은 닉네임은 최고 기록 한 건만 남긴다(이미 rankScore 내림차순이라 첫 등장이 최고).
function dedupeByNickname(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (seen.has(row.nickname)) continue;
    seen.add(row.nickname);
    out.push(row);
  }
  return out;
}

function subscribeTop(callback) {
  const topQuery = query(scoresCol, orderBy("rankScore", "desc"), limit(FETCH_LIMIT));
  return onSnapshot(
    topQuery,
    (snap) => {
      const rows = snap.docs.map((doc) => doc.data());
      callback(dedupeByNickname(rows));
    },
    (err) => {
      console.error("[KokkoLB] 순위 구독 오류:", err);
    }
  );
}

window.KokkoLB = { submitScore, subscribeTop, computeRankScore };
window.dispatchEvent(new Event("kokko-lb-ready"));
