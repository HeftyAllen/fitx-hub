// Motivational quote bank for the Suggestions card.
// Selection is deterministic per (uid, date) so a user sees one quote per day,
// and the last-7 picks are skipped so quotes don't repeat in a tight window.

export interface Quote { text: string; author?: string; tag?: "general" | "strength" | "endurance" | "fatloss" | "muscle" | "mindset"; }

export const QUOTES: Quote[] = [
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln", tag: "mindset" },
  { text: "The body achieves what the mind believes.", tag: "mindset" },
  { text: "You don't have to be extreme, just consistent.", tag: "general" },
  { text: "Sweat is just fat crying.", tag: "fatloss" },
  { text: "If it doesn't challenge you, it won't change you.", author: "Fred DeVito", tag: "general" },
  { text: "Strength does not come from the physical capacity. It comes from an indomitable will.", author: "Gandhi", tag: "strength" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", tag: "strength" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali", tag: "general" },
  { text: "A one hour workout is 4% of your day. No excuses.", tag: "general" },
  { text: "Push yourself because no one else is going to do it for you.", tag: "mindset" },
  { text: "Success starts with self-discipline.", tag: "mindset" },
  { text: "Train insane or remain the same.", tag: "general" },
  { text: "The clock is ticking. Are you becoming the person you want to be?", author: "Greg Plitt", tag: "mindset" },
  { text: "You are confined only by the walls you build yourself.", tag: "mindset" },
  { text: "Wake up with determination. Go to bed with satisfaction.", tag: "general" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso", tag: "mindset" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke", tag: "general" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee", tag: "mindset" },
  { text: "You miss 100% of the workouts you don't do.", tag: "general" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin", tag: "endurance" },
  { text: "Suffer the pain of discipline or suffer the pain of regret.", tag: "mindset" },
  { text: "The only bad workout is the one that didn't happen.", tag: "general" },
  { text: "Don't wish for it. Work for it.", tag: "general" },
  { text: "Fall seven times, stand up eight.", tag: "mindset" },
  { text: "Once you are exercising regularly, the hardest thing is to stop it.", author: "Erin Gray", tag: "general" },
  { text: "Make yourself proud.", tag: "mindset" },
  { text: "Slow progress is still progress.", tag: "general" },
  { text: "Your only limit is you.", tag: "mindset" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn", tag: "general" },
  { text: "Excuses don't burn calories.", tag: "fatloss" },
  { text: "Be stronger than your strongest excuse.", tag: "strength" },
  { text: "Tough times never last, but tough people do.", author: "Robert H. Schuller", tag: "mindset" },
  { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem", tag: "mindset" },
  { text: "Don't stop when you're tired. Stop when you're done.", tag: "general" },
  { text: "Sore today, strong tomorrow.", tag: "muscle" },
  { text: "Strive for progress, not perfection.", tag: "general" },
  { text: "Earn your body.", tag: "general" },
  { text: "Stop wishing. Start doing.", tag: "mindset" },
  { text: "You don't find willpower, you create it.", tag: "mindset" },
  { text: "What hurts today makes you stronger tomorrow.", author: "Jay Cutler", tag: "strength" },
  { text: "Muscles aren't built in the gym. They're built in the kitchen.", tag: "muscle" },
  { text: "If you can't fly, run. If you can't run, walk. Just keep moving.", author: "MLK Jr.", tag: "endurance" },
  { text: "It never gets easier; you just get stronger.", tag: "strength" },
  { text: "The difference between try and triumph is a little umph.", tag: "general" },
  { text: "The best way to predict your future is to create it.", author: "Peter Drucker", tag: "mindset" },
  { text: "When you feel like quitting, think about why you started.", tag: "mindset" },
  { text: "Don't limit your challenges. Challenge your limits.", tag: "general" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King", tag: "mindset" },
  { text: "Pain is weakness leaving the body.", tag: "strength" },
  { text: "Train hard, live easy.", tag: "general" },
  { text: "Eat for the body you want, not for the body you have.", tag: "fatloss" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", tag: "general" },
  { text: "If you want something you've never had, you must be willing to do something you've never done.", author: "Thomas Jefferson", tag: "mindset" },
  { text: "Forget motivation. Build the habit.", tag: "mindset" },
  { text: "Discomfort is the price of admission to a meaningful life.", author: "Susan David", tag: "mindset" },
  { text: "Be relentless in pursuit of what sets your soul on fire.", tag: "mindset" },
  { text: "Comparison is the thief of joy. Run your own race.", tag: "mindset" },
  { text: "Show up — especially on the days you don't feel like it.", tag: "general" },
  { text: "Small daily improvements are the key to staggering long-term results.", tag: "general" },
  { text: "Your future is created by what you do today, not tomorrow.", tag: "mindset" },
  { text: "Be patient with yourself. Self-growth is tender; it's holy ground.", author: "Stephen Covey", tag: "mindset" },
  { text: "Eat clean, train mean, look lean.", tag: "fatloss" },
  { text: "Heavy weights, heavy plates, heavy gains.", tag: "muscle" },
  { text: "Volume builds the engine. Intensity sharpens it.", tag: "endurance" },
  { text: "Recovery isn't optional — it's where the growth happens.", tag: "muscle" },
  { text: "Don't be afraid to be a beginner.", tag: "mindset" },
  { text: "Sleep is the steroid you're not taking enough of.", tag: "muscle" },
  { text: "Hydration is a habit, not a hack.", tag: "general" },
  { text: "Protein, sleep, lift. Repeat.", tag: "muscle" },
  { text: "Cardio is conversation with your heart.", tag: "endurance" },
  { text: "A 5-minute walk beats a perfect plan that never starts.", tag: "general" },
  { text: "You're one workout away from a good mood.", tag: "general" },
  { text: "Move every day, even just a little. Momentum is everything.", tag: "general" },
  { text: "Aim for one percent better. Compound it forever.", tag: "mindset" },
  { text: "Your goal doesn't care about your mood. Show up anyway.", tag: "mindset" },
  { text: "Track it to change it.", tag: "general" },
  { text: "Weak today does not mean weak forever.", tag: "strength" },
  { text: "The bar doesn't care how you feel. Just lift it.", tag: "strength" },
  { text: "Lift heavy, eat well, sleep more.", tag: "muscle" },
  { text: "Every meal is a vote for the body you want.", tag: "general" },
  { text: "Don't break the chain.", author: "Jerry Seinfeld", tag: "mindset" },
  { text: "Effort is the currency of progress.", tag: "general" },
  { text: "Be the person your past self would be proud of.", tag: "mindset" },
  { text: "Hard choices, easy life. Easy choices, hard life.", tag: "mindset" },
  { text: "Don't outwork a bad diet.", tag: "fatloss" },
  { text: "You don't need a new program. You need to finish the one you started.", tag: "mindset" },
  { text: "Get comfortable being uncomfortable.", tag: "mindset" },
  { text: "Sweat now, shine later.", tag: "general" },
  { text: "Your only competition is yesterday's you.", tag: "general" },
  { text: "Mind over matter. If you don't mind, it doesn't matter.", author: "Mark Twain", tag: "mindset" },
  { text: "The gym is cheaper than therapy — and works too.", tag: "general" },
  { text: "Plan the work. Work the plan.", tag: "general" },
  { text: "Form first. Weight second. Ego last.", tag: "strength" },
  { text: "Rest, but never quit.", tag: "endurance" },
  { text: "You can. End of story.", tag: "mindset" },
  { text: "If the bar isn't bending, you're just pretending.", tag: "strength" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry", tag: "general" },
  { text: "Every champion was once a contender that refused to give up.", author: "Rocky Balboa", tag: "mindset" },
  { text: "Don't tell people your plans. Show them your results.", tag: "mindset" },
  { text: "Push through. The view at the top is worth it.", tag: "endurance" },
  { text: "Train like a beast, look like a beauty.", tag: "general" },
  { text: "Discipline equals freedom.", author: "Jocko Willink", tag: "mindset" },
  { text: "Embrace the suck.", tag: "mindset" },
  { text: "Be the hardest worker in the room.", tag: "mindset" },
  { text: "Become the storm, not the leaf.", tag: "mindset" },
  { text: "Run when you can, walk if you have to, crawl if you must — just never give up.", author: "Dean Karnazes", tag: "endurance" },
  { text: "The hardest lift of all is lifting your butt off the couch.", tag: "general" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston", tag: "mindset" },
  { text: "Train for the body you want, not the body you have today.", tag: "muscle" },
  { text: "Make peace with the iron.", tag: "strength" },
  { text: "Your body hears everything your mind says.", author: "Naomi Judd", tag: "mindset" },
  { text: "Stop wishing. Start sweating.", tag: "general" },
  { text: "Don't think about it. Do it.", tag: "mindset" },
  { text: "Pain is fuel.", tag: "strength" },
  { text: "Stay hungry. Stay humble. Stay grinding.", tag: "mindset" },
  { text: "Today is a great day to get stronger.", tag: "strength" },
  { text: "Strong is the new sexy.", tag: "strength" },
  { text: "Show your body what it's capable of.", tag: "general" },
  { text: "Quiet the mind. Move the body.", tag: "mindset" },
  { text: "There is no elevator to success. You have to take the stairs.", author: "Zig Ziglar", tag: "mindset" },
  { text: "Today's workout is tomorrow's confidence.", tag: "general" },
  { text: "Stay strong. Make them wonder how you're doing it.", tag: "mindset" },
  { text: "The only person you should try to be better than is the person you were yesterday.", tag: "mindset" },
  { text: "Set a goal so big you can't achieve it until you grow into the person who can.", tag: "mindset" },
  { text: "Wishbones won't get you there. Backbones will.", tag: "mindset" },
  { text: "Sweat, smile, repeat.", tag: "general" },
  { text: "Trust the process.", tag: "mindset" },
  { text: "Strong people lift other people up.", tag: "general" },
  { text: "Be patient. The fruit takes time to ripen.", tag: "general" },
  { text: "Health is wealth.", tag: "general" },
  { text: "Form is the loudest flex.", tag: "strength" },
  { text: "Earn the rest.", tag: "general" },
  { text: "Big plates, big plates, big gains.", tag: "muscle" },
  { text: "The barbell doesn't lie.", tag: "strength" },
  { text: "Reps are receipts.", tag: "general" },
  { text: "Sleep is when you grow.", tag: "muscle" },
  { text: "Calories in, calories out — but quality matters.", tag: "fatloss" },
  { text: "Lift heavy. Eat smart. Sleep deep.", tag: "muscle" },
  { text: "Win the morning. Win the day.", tag: "mindset" },
  { text: "Conquer the inner couch potato.", tag: "general" },
  { text: "Less doomscrolling. More deadlifting.", tag: "general" },
  { text: "Discipline now, freedom later.", tag: "mindset" },
];

const RECENT_KEY_PREFIX = "fitx_recent_quotes_v1_";
const RECENT_WINDOW = 7;

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getQuoteOfDay(uid: string | null, isoDate: string, goalType?: string): Quote {
  const key = `${RECENT_KEY_PREFIX}${uid || "anon"}`;
  let recent: string[] = [];
  try { recent = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* ignore */ }

  // Bias selection toward quotes tagged for the user's goal when possible.
  const goalTag: Quote["tag"] | undefined =
    goalType === "muscle"    ? "muscle"
  : goalType === "lose"      ? "fatloss"
  : goalType === "endurance" ? "endurance"
  : undefined;

  const pool = QUOTES.map((q, i) => ({ q, i }));
  const seed = djb2(`${uid || "anon"}|${isoDate}`);
  const ordered = pool
    .map(({ q, i }) => ({
      q,
      i,
      score:
        (recent.includes(String(i)) ? 1_000_000 : 0) +
        (goalTag && q.tag === goalTag ? 0 : 50) +
        ((seed + i * 2654435761) >>> 0) % 1000,
    }))
    .sort((a, b) => a.score - b.score);

  const picked = ordered[0];
  const next = [String(picked.i), ...recent.filter(x => x !== String(picked.i))].slice(0, RECENT_WINDOW);
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  return picked.q;
}
