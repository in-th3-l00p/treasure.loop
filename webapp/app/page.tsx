"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const checkpoints = [
  { name: "Piața Unirii", where: "Central square, north plinth" },
  { name: "Bastionul", where: "Old wall, east gate" },
  { name: "Cluj Arena", where: "Riverside entrance" },
  { name: "Strada Sforii", where: "The narrow lane" },
  { name: "Turnul Croitorilor", where: "Hilltop lookout" },
  { name: "Parcul Central", where: "Casino lawn" },
];

const steps = [
  {
    number: "01",
    title: "Start with a code",
    body: "Attendees scan the opening marker and get routed into a clue path built for the venue.",
  },
  {
    number: "02",
    title: "Visit staffed checkpoints",
    body: "Sponsors reveal per-interaction codes, so progress depends on real booth visits and conversations.",
  },
  {
    number: "03",
    title: "Close the loop",
    body: "Completion mints a badge to the player wallet and unlocks the prize desk flow.",
  },
];

const rewards = [
  {
    title: "On-chain badge",
    body: "A collectible proof of completion, minted only after the off-chain route is finished.",
  },
  {
    title: "Prize desk gating",
    body: "High-value rewards stay physical and human-verified, keeping the hunt resistant to farming.",
  },
  {
    title: "Qualified sponsor traffic",
    body: "Each checkpoint creates a reason for attendees to stop, talk, and continue the route.",
  },
];

const faqs = [
  [
    "Do guests need to install an app?",
    "No. The hunt runs in the browser from QR or NFC entry points.",
  ],
  [
    "Where does Web3 enter the flow?",
    "Gameplay stays off-chain for speed. Only successful completion settles as a wallet badge.",
  ],
  [
    "Can clues require collaboration?",
    "Yes. Some checkpoints can split fragments between players so strangers have to find each other.",
  ],
  [
    "Who configures the event?",
    "Organizers set the route, checkpoint locations, reward tiers, and completion rules.",
  ],
];

function Glyph() {
  return (
    <span className="glyph" aria-hidden="true">
      <span className="glyph-glow" />
      <span className="glyph-ring" />
      <span className="glyph-core" />
    </span>
  );
}

function PhoneDemo() {
  const [index, setIndex] = useState(2);
  const [closed, setClosed] = useState(false);
  const active = checkpoints[Math.min(index - 1, checkpoints.length - 1)];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= checkpoints.length) {
          setClosed((isClosed) => !isClosed);
          return 1;
        }

        setClosed(false);
        return current + 1;
      });
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={`phone ${closed ? "phone-closed" : ""}`} aria-label="Checkpoint progress preview">
      <div className="phone-shine" aria-hidden="true" />
      <div className="phone-status">
        <span>9:41</span>
        <span>LTE 100%</span>
      </div>
      <div className="phone-cover">
        <span className="cover-pulse" aria-hidden="true" />
        <p>{closed ? "Loop complete" : "Checkpoint unlocked"}</p>
        <span>Checkpoint {String(index).padStart(2, "0")} of 06</span>
        <h2>{closed ? "Reward desk" : active.name}</h2>
      </div>
      <div className="phone-body">
        <div className="phone-row">
          <span className="row-icon" aria-hidden="true" />
          <div>
            <p>When</p>
            <strong>Now, open until 18:00</strong>
          </div>
        </div>
        <div className="phone-row">
          <span className="row-icon row-icon-alt" aria-hidden="true" />
          <div>
            <p>Where</p>
            <strong>{closed ? "Physical redemption desk" : active.where}</strong>
          </div>
        </div>
        <div className="progress-card">
          <div>
            <strong>Your loop</strong>
            <span>{closed ? "6 / 6" : `${index} / 6`}</span>
          </div>
          <div className="bars" aria-hidden="true">
            {checkpoints.map((checkpoint, itemIndex) => (
              <i
                key={checkpoint.name}
                className={closed || itemIndex < index ? "bar-on" : ""}
              />
            ))}
          </div>
        </div>
      </div>
      <button className="phone-button" type="button">
        {closed ? "Badge unlocked" : "Check in here"}
      </button>
      <p className="phone-caption">
        {closed ? "Prize layer is ready" : "Hold phone to NFC tag"}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="TreasureLoop home">
          <Glyph />
          <span>TreasureLoop</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how">How it works</a>
          <a href="#rewards">Rewards</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link className="header-cta" href="/login">
          Open console
        </Link>
      </header>

      <section className="hero" id="top">
        <div className="aurora aurora-one" aria-hidden="true" />
        <div className="aurora aurora-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">Treasure hunt protocol for Web3 conferences</p>
          <h1>
            Turn the venue into a playable map.
          </h1>
          <p className="hero-sub">
            TreasureLoop routes attendees between staffed sponsor checkpoints,
            unlocks clues through real-world interaction, then mints completion
            as an on-chain badge.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/login">
              Join the hunt
            </Link>
            <Link className="secondary-action" href="/app">
              View mock app
            </Link>
          </div>
          <div className="signal-row" aria-label="Product highlights">
            <span>No gas friction</span>
            <span>Staffed sponsor stations</span>
            <span>Physical prize desk</span>
          </div>
        </div>
        <div className="hero-device">
          <PhoneDemo />
        </div>
      </section>

      <section className="section split" id="how">
        <div>
          <p className="eyebrow">How it works</p>
          <h2>Fast gameplay, real presence, verifiable completion.</h2>
        </div>
        <div className="steps">
          {steps.map((step) => (
            <article className="step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section rewards-section" id="rewards">
        <div className="section-heading">
          <p className="eyebrow">Reward layer</p>
          <h2>Completion should feel earned.</h2>
          <p>
            The protocol keeps the hunt lightweight for players while giving
            organizers durable proof, redemption controls, and sponsor value.
          </p>
        </div>
        <div className="rewards-grid">
          {rewards.map((reward) => (
            <article className="reward" key={reward.title}>
              <span className="reward-mark" aria-hidden="true" />
              <h3>{reward.title}</h3>
              <p>{reward.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section story-band">
        <p>
          Selected clues can require two players to combine fragments, turning
          the conference floor into a reason to meet someone new.
        </p>
      </section>

      <section className="section faq-section" id="faq">
        <div className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2>The short answers.</h2>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <p className="eyebrow">Built by intheloop</p>
        <h2>Ready to make your event a loop?</h2>
        <p>
          Configure the graph, place the checkpoints, and let the crowd chase
          the route from booth to booth.
        </p>
        <Link className="primary-action" href="/login">
          Start a deployment
        </Link>
      </section>

      <footer className="footer">
        <a className="brand" href="#top">
          <Glyph />
          <span>TreasureLoop</span>
        </a>
        <span>Cluj-Napoca, built for conference floors.</span>
      </footer>
    </main>
  );
}
