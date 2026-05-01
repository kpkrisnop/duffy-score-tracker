import { useState, useEffect, useRef } from "react";

// Define the DuffyGame component
function DuffyGame() {
  const suits = ["♠️ Spade", "♥️ Heart", "♦️ Diamond", "♣️ Club"];
  const [round, setRound] = useState(1);
  const [bids, setBids] = useState(["", "", "", ""]);
  const [wins, setWins] = useState(["", "", "", ""]);
  const [names, setNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [scores, setScores] = useState([0, 0, 0, 0]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [firstPlayer, setFirstPlayer] = useState(null);
  const [secondPlayer, setSecondPlayer] = useState(null);
  const [direction, setDirection] = useState(null);
  const [gasUrl, setGasUrl] = useState(
    localStorage.getItem("duffy_gas_url") || "",
  );
  const [saveStatus, setSaveStatus] = useState({ type: "", message: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Refs for input elements to handle focus
  const bidRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const winRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Effect to determine player order at the start of each round
  useEffect(() => {
    if (round === 1 && firstPlayer === null) {
      const fp = 0;
      const dir = 1;
      const sp = (fp + dir + 4) % 4;
      setFirstPlayer(fp);
      setSecondPlayer(sp);
      setDirection(dir);
    } else if (round > 1 && history.length > 0) {
      const prevSecond = secondPlayer;
      const nextFirst = prevSecond;
      const nextSecond = (nextFirst + direction + 4) % 4;
      setFirstPlayer(nextFirst);
      setSecondPlayer(nextSecond);
    }
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardsThisRound = round <= 13 ? 14 - round : 1;

  // Helper to cycle values (increment) for a given player and type
  const cycleValue = (type, playerIndex) => {
    const currentArr = type === "bid" ? bids : wins;
    const currentValStr = currentArr[playerIndex];
    const currentVal = currentValStr === "" ? -1 : parseInt(currentValStr, 10);

    let nextVal = currentVal + 1;

    // Calculate max possible value
    let maxVal;
    if (type === "bid") {
      maxVal = cardsThisRound;
    } else {
      // For wins, it's technically bounded by remaining cards, but usually just cardsThisRound for input cycling convenience
      // or loosely bounded. Let's use getWinOptions logic or just cardsThisRound to keep it simple and consistent with UI dropdown logic potentially.
      // The UI `getWinOptions` is smarter, but for keyboard cycling, let's strictly respect `getWinOptions` upper bound if possible,
      // but `getWinOptions` depends on *other* wins.

      // Re-calculating dynamic max for wins similar to getWinOptions:
      const otherWinsSum = wins.reduce(
        (sum, w, i) => (i === playerIndex ? sum : sum + Number(w || 0)),
        0,
      );
      maxVal = Math.max(0, cardsThisRound - otherWinsSum);
    }

    if (nextVal > maxVal) {
      nextVal = 0;
    }

    if (type === "bid") {
      handleBidChange(playerIndex, nextVal.toString());
    } else {
      handleWinChange(playerIndex, nextVal.toString());
    }
  };

  // Prevent tab close if game is active
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (history.length > 0 || round > 1) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [history, round]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if modifier keys are pressed (except Shift maybe, but keeping it simple)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore if the user is typing in a text input or textarea
      const target = e.target;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isTyping) return;

      // 1. Input Selection & Increment
      const bidKeys = ["KeyQ", "KeyW", "KeyE", "KeyR"];
      const winKeys = ["KeyA", "KeyS", "KeyD", "KeyF"];

      const bidIndex = bidKeys.indexOf(e.code);
      if (bidIndex !== -1) {
        e.preventDefault();
        const ref = bidRefs[bidIndex].current;
        if (document.activeElement === ref) {
          // Already selected, increment
          cycleValue("bid", bidIndex);
        } else {
          ref?.focus();
        }
        return;
      }

      const winIndex = winKeys.indexOf(e.code);
      if (winIndex !== -1) {
        e.preventDefault();
        const ref = winRefs[winIndex].current;
        if (document.activeElement === ref) {
          // Already selected, increment
          cycleValue("win", winIndex);
        } else {
          ref?.focus();
        }
        return;
      }

      // 2. Numeric Input (0-9)
      if (/^[0-9]$/.test(e.key)) {
        const numVal = parseInt(e.key, 10);

        // Check if a bid input is focused
        const activeBidIndex = bidRefs.findIndex(
          (ref) => ref.current === document.activeElement,
        );
        if (activeBidIndex !== -1) {
          e.preventDefault();
          if (numVal <= cardsThisRound) {
            // Basic validation
            // Also check forbidden rules if strict, but UI validation handles error state.
            // We'll set it, and let validation logic run in handleBidChange
            handleBidChange(activeBidIndex, numVal.toString());
          }
          return;
        }

        // Check if a win input is focused
        const activeWinIndex = winRefs.findIndex(
          (ref) => ref.current === document.activeElement,
        );
        if (activeWinIndex !== -1) {
          e.preventDefault();
          // Basic validation against max cards
          if (numVal <= cardsThisRound) {
            handleWinChange(activeWinIndex, numVal.toString());
          }
          return;
        }
      }

      // 3. Game Control
      if (e.code === "KeyN") {
        // Check if submit is allowed
        const isSubmitDisabled =
          !!error || bids.some((b) => b === "") || wins.some((w) => w === "");
        if (!isSubmitDisabled) {
          e.preventDefault();
          handleSubmit();
        }
      } else if (e.code === "KeyU") {
        if (history.length > 0 && round > 1) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bids, wins, round, error, history, cardsThisRound]); // eslint-disable-line react-hooks/exhaustive-deps

  const trumpSuit =
    round === 14
      ? "♥️ Heart"
      : round === 15
        ? "♦️ Diamond"
        : round === 16
          ? "♣️ Club"
          : suits[(round - 1) % 4];

  const remainingCards =
    cardsThisRound - bids.reduce((sum, b) => sum + Number(b || 0), 0);

  const validateInput = (bidsInput, winsInput) => {
    const filledBids = bidsInput.filter((b) => b !== "");
    const sumBids = bidsInput.reduce((sum, b) => sum + Number(b || 0), 0);
    const filledWins = winsInput.filter((w) => w !== "");
    const sumWins = winsInput.reduce((sum, w) => sum + Number(w || 0), 0);

    if (filledBids.length === 4 && sumBids === cardsThisRound) {
      setError(`Bid sum must equal ${cardsThisRound}`);
      return false;
    } else if (filledWins.length === 4 && sumWins !== cardsThisRound) {
      setError(`Win sum must equal ${cardsThisRound}`);
      return false;
    } else {
      setError("");
      return true;
    }
  };

  const handleBidChange = (index, value) => {
    const newBids = [...bids];
    newBids[index] = value;
    setBids(newBids);
    validateInput(newBids, wins);
  };

  const handleWinChange = (index, value) => {
    const newWins = [...wins];
    newWins[index] = value;
    setWins(newWins);
    validateInput(bids, newWins);
  };

  const handleNameChange = (index, value) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  const handleSubmit = () => {
    if (round > 16 || !validateInput(bids, wins)) return;

    const newScores = [...scores];
    const roundData = [];

    for (let i = 0; i < 4; i++) {
      const bid = Number(bids[i]);
      const win = Number(wins[i]);
      const score = bid === win ? 5 + win : win;
      newScores[i] += score;
      roundData.push({ player: names[i], bid, win, score });
    }

    setScores(newScores);
    setHistory([...history, { round, trumpSuit, cardsThisRound, roundData }]);
    setRound(round + 1);
    setBids(["", "", "", ""]);
    setWins(["", "", "", ""]);
    setError("");
  };

  const handleUndo = () => {
    if (history.length === 0 || round <= 1) return;

    const newHistory = history.slice(0, -1);
    const newScores = [0, 0, 0, 0];

    newHistory.forEach((r) => {
      r.roundData.forEach((d, playerIndex) => {
        const originalPlayerIndex = names.findIndex(
          (name) => name === d.player,
        );
        if (originalPlayerIndex !== -1) {
          newScores[originalPlayerIndex] += d.score;
        } else {
          newScores[playerIndex] += d.score;
        }
      });
    });

    setScores(newScores);
    setHistory(newHistory);
    setRound(round - 1);
    setError("");
    setBids(["", "", "", ""]);
    setWins(["", "", "", ""]);
  };

  const handleSaveToSheets = async () => {
    if (!gasUrl) {
      setSaveStatus({
        type: "error",
        message: "Please provide a Google Apps Script URL",
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: "info", message: "Saving to Google Sheets..." });

    try {
      // Prepare data for the sheet
      const payload = {
        gameDate: new Date().toLocaleString(),
        players: names,
        finalScores: scores,
        history: history.map((h) => ({
          round: h.round,
          trump: h.trumpSuit,
          cards: h.cardsThisRound,
          data: h.roundData,
        })),
      };

      // Use No-Cors if the user hasn't set up CORS in GAS,
      // but standard Fetch should work with GAS web apps if they return proper headers.
      // However, GAS 'Redirect' behavior often causes CORS issues in browsers.
      // A common workaround is using 'no-cors' for simple fire-and-forget,
      // but we want to know if it succeeded.
      const response = await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors", // GAS web apps often require this from static sites
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Since 'no-cors' doesn't allow reading response, we assume success if no error thrown
      setSaveStatus({
        type: "success",
        message: "Data sent to Google Sheets! Check your sheet.",
      });
      localStorage.setItem("duffy_gas_url", gasUrl);
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus({
        type: "error",
        message: "Failed to save. Check URL and permissions.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getBidOptions = (playerIndex) => {
    const options = [];
    for (let i = 0; i <= cardsThisRound; i++) {
      const tempBids = [...bids];
      tempBids[playerIndex] = i.toString();
      const tempSum = tempBids.reduce((sum, b) => sum + Number(b || 0), 0);

      let isForbidden = false;
      const filledBidsCount = tempBids.filter((b) => b !== "").length;
      if (filledBidsCount === 4 && tempSum === cardsThisRound) {
        isForbidden = true;
      }
      options.push({ value: i, isForbidden });
    }
    return options;
  };

  const getWinOptions = (playerIndex) => {
    const options = [];
    const otherWinsSum = wins.reduce(
      (sum, w, i) => (i === playerIndex ? sum : sum + Number(w || 0)),
      0,
    );
    const maxPossibleWinForThisPlayer = Math.max(
      0,
      cardsThisRound - otherWinsSum,
    );

    for (let i = 0; i <= maxPossibleWinForThisPlayer; i++) {
      const tempWins = [...wins];
      tempWins[playerIndex] = i.toString();
      const tempSum = tempWins.reduce((sum, w) => sum + Number(w || 0), 0);
      const filledWinsCount = tempWins.filter((w) => w !== "").length;

      let isTarget = false;
      if (filledWinsCount === 4 && tempSum === cardsThisRound) {
        isTarget = true;
      }
      options.push({ value: i, isTarget });
    }
    return options;
  };

  return (
    <div className="min-h-screen bg-white text-[#37352F] p-8 md:p-12 max-w-4xl mx-auto selection:bg-[#CDE8F0]">
      {/* Header */}
      <div className="mb-12 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🃏</span>
          <h1 className="text-4xl font-bold tracking-tight text-black">
            Duffy Score Tracker
          </h1>
        </div>
        <p className="text-gray-500 text-lg">
          Track and record your Duffy scores.
        </p>
      </div>

      {/* Game Status Callout */}
      {round <= 16 ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-6 p-5 bg-[#F7F7F5] rounded-lg border border-[#E9E9E7]">
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                Round
              </div>
              <div className="text-3xl font-bold font-mono">{round}/16</div>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                Trump Suit
              </div>
              <div className="text-2xl">{trumpSuit}</div>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                Cards / Player
              </div>
              <div className="text-2xl font-mono">{cardsThisRound}</div>
            </div>
            <div className="flex-1 border-l border-gray-300 pl-6">
              <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
                Remaining Bids
              </div>
              <div className="text-2xl font-bold text-red-600">
                {Math.max(0, remainingCards)}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FDE8E8] text-[#C53030] rounded border border-[#FBCFE8] flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Players Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            {names.map((player, i) => {
              let statusColor = "bg-white";
              let statusLabel = null;
              if (i === firstPlayer) {
                statusColor = "bg-green-50";
                statusLabel = (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                    First
                  </span>
                );
              } else if (i === secondPlayer) {
                // statusColor = 'bg-orange-50';
              } else {
                if (firstPlayer !== null && direction !== null) {
                  const order = [firstPlayer];
                  for (let j = 1; j < 4; j++) {
                    order.push((firstPlayer + direction * j + 4) % 4);
                  }
                  const lastPlayerToBid = order[3];
                  if (i === lastPlayerToBid) {
                    statusColor = "bg-red-50";
                    statusLabel = (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                        Last
                      </span>
                    );
                  }
                }
              }

              return (
                <div
                  key={i}
                  className={`p-4 flex flex-col gap-3 ${statusColor} transition-colors`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-xs text-gray-400 font-mono">
                      P{i + 1}
                    </div>
                    {statusLabel}
                  </div>
                  <input
                    type="text"
                    value={names[i]}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    className="w-full bg-transparent border-b border-gray-300 focus:border-black focus:outline-none p-1 font-semibold text-lg placeholder-gray-300 transition-colors"
                    placeholder="Name"
                  />

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Bid
                      </label>
                      <select
                        ref={bidRefs[i]}
                        value={bids[i]}
                        onChange={(e) => handleBidChange(i, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-black focus:border-black outline-none appearance-none"
                      >
                        <option value="">-</option>
                        {getBidOptions(i).map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className={
                              opt.isForbidden ? "text-red-600 font-bold" : ""
                            }
                          >
                            {opt.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">
                        Won
                      </label>
                      <select
                        ref={winRefs[i]}
                        value={wins[i]}
                        onChange={(e) => handleWinChange(i, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-black focus:border-black outline-none appearance-none"
                      >
                        <option value="">-</option>
                        {getWinOptions(i).map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className={
                              opt.isTarget ? "text-green-600 font-bold" : ""
                            }
                          >
                            {opt.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Score</span>
                    <span className="text-lg font-bold font-mono">
                      {scores[i]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSubmit}
              disabled={
                !!error ||
                bids.some((b) => b === "") ||
                wins.some((w) => w === "")
              }
              className="bg-black text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 px-6 py-2.5 rounded font-medium text-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Next Round
            </button>
            <button
              onClick={handleUndo}
              disabled={round <= 1 || history.length === 0}
              className="text-gray-500 hover:text-black hover:bg-gray-100 disabled:text-gray-300 disabled:hover:bg-transparent px-4 py-2.5 rounded font-medium text-sm transition-all"
            >
              Undo
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-[#F7F7F5] rounded-xl border border-[#E9E9E7]">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">Game Complete</h2>
          <p className="text-gray-500">Congratulations to the winner!</p>
        </div>
      )}

      {/* Overall Scores */}
      <div className="mt-16">
        <h3 className="text-lg font-bold border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
          <span className="text-gray-400">#</span> Leaderboard
        </h3>
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scores.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium bg-white">
                    {names[i] || `Player ${i + 1}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold bg-white">
                    {s}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-bold border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
            <span className="text-gray-400">#</span> History
          </h3>
          <div className="space-y-6">
            {history
              .slice()
              .reverse()
              .map((h, index) => (
                <div key={index} className="group">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <span className="font-mono bg-gray-100 px-1.5 rounded text-gray-800">
                      R{h.round}
                    </span>
                    <span>•</span>
                    <span className="text-gray-800">{h.trumpSuit}</span>
                    <span>•</span>
                    <span>{h.cardsThisRound} cards</span>
                  </div>
                  <div className="w-full overflow-hidden border border-gray-200 rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7F7F5] text-xs text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left font-normal">
                            Player
                          </th>
                          <th className="px-4 py-2 text-center font-normal">
                            Bid
                          </th>
                          <th className="px-4 py-2 text-center font-normal">
                            Won
                          </th>
                          <th className="px-4 py-2 text-right font-normal">
                            Points
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {h.roundData.map((d, i) => (
                          <tr
                            key={i}
                            className="bg-white hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-2 text-gray-900">
                              {d.player}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">
                              {d.bid}
                            </td>
                            <td className="px-4 py-2 text-center text-gray-500">
                              {d.win}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-medium">
                              {d.score > 0 ? `+${d.score}` : d.score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Google Sheets Integration */}
      <div className="mt-16 pt-8 border-t border-gray-200">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-gray-400">#</span> Save to Google Sheets
        </h3>
        <div className="bg-[#F7F7F5] p-6 rounded-lg border border-[#E9E9E7]">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold uppercase text-gray-500">
                Apps Script Web App URL
              </label>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="text-xs font-medium text-black-600 hover:text-black-900 underline flex items-center gap-1"
              >
                {showInstructions ? "Hide Setup Guide" : "How to setup?"}
              </button>
            </div>

            {showInstructions && (
              <div className="text-sm bg-white border border-gray-200 rounded p-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <h4 className="font-bold mb-2 text-black">Setup Guide:</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-4">
                  <li>
                    Open your{" "}
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Google Sheet
                    </a>
                    .
                  </li>
                  <li>
                    Go to <strong>Extensions &gt; Apps Script</strong>.
                  </li>
                  <li>Delete everything and paste the code below.</li>
                  <li>
                    Click <strong>Deploy &gt; New deployment</strong>.
                  </li>
                  <li>
                    Select <strong>Web app</strong>, "Execute as:{" "}
                    <strong>Me</strong>", "Who has access:{" "}
                    <strong>Anyone</strong>".
                  </li>
                  <li>
                    Copy the <strong>Web App URL</strong> and paste it into the
                    field below.
                  </li>
                </ol>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase text-gray-400">
                      Apps Script Code
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `function doPost(e) {\n  var ss = SpreadsheetApp.getActiveSpreadsheet();\n  var sheet = ss.getActiveSheet();\n  var data = JSON.parse(e.postData.contents);\n  \n  sheet.appendRow(["Game Date", "Player 1", "P1 Score", "Player 2", "P2 Score", "Player 3", "P3 Score", "Player 4", "P4 Score"]);\n  sheet.appendRow([data.gameDate, data.players[0], data.finalScores[0], data.players[1], data.finalScores[1], data.players[2], data.finalScores[2], data.players[3], data.finalScores[3]]);\n  \n  sheet.appendRow(["---", "---", "---", "---", "---", "---", "---", "---", "---"]);\n  sheet.appendRow(["Round", "Trump", "Cards", "P1 Bid", "P1 Won", "P2 Bid", "P2 Won", "P3 Bid", "P3 Won", "P4 Bid", "P4 Won"]);\n  \n  data.history.forEach(function(h) {\n    var row = [h.round, h.trump, h.cards];\n    h.data.forEach(function(d) {\n      row.push(d.bid);\n      row.push(d.win);\n    });\n    sheet.appendRow(row);\n  });\n  \n  sheet.appendRow(["", "", "", "", "", "", "", "", "", "", ""]);\n  \n  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);\n}`,
                        );
                        alert("Code copied to clipboard!");
                      }}
                      className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                    >
                      Copy Code
                    </button>
                  </div>
                  <pre className="bg-gray-50 p-3 rounded text-[11px] font-mono overflow-x-auto text-gray-500 border border-gray-100 max-h-48">
                    {`function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  sheet.appendRow(["Game Date", "Player 1", "P1 Score", "Player 2", "P2 Score", "Player 3", "P3 Score", "Player 4", "P4 Score"]);
  sheet.appendRow([data.gameDate, data.players[0], data.finalScores[0], data.players[1], data.finalScores[1], data.players[2], data.finalScores[2], data.players[3], data.finalScores[3]]);
  
  sheet.appendRow(["---", "---", "---", "---", "---", "---", "---", "---", "---"]);
  sheet.appendRow(["Round", "Trump", "Cards", "P1 Bid", "P1 Won", "P2 Bid", "P2 Won", "P3 Bid", "P3 Won", "P4 Bid", "P4 Won"]);
  
  data.history.forEach(function(h) {
    var row = [h.round, h.trump, h.cards];
    h.data.forEach(function(d) {
      row.push(d.bid);
      row.push(d.win);
    });
    sheet.appendRow(row);
  });
  
  sheet.appendRow([" ", " ", " ", " ", " ", " ", " ", " ", " "]);
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}`}
                  </pre>
                </div>
              </div>
            )}

            <div>
              <input
                type="text"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-black focus:border-black outline-none"
              />
              <p className="mt-2 text-xs text-gray-400">
                Paste your deployed Google Apps Script URL here. It will be
                remembered on this device.
              </p>
            </div>

            {saveStatus.message && (
              <div
                className={`p-3 rounded text-sm ${
                  saveStatus.type === "error"
                    ? "bg-red-50 text-red-600 border border-red-100"
                    : saveStatus.type === "success"
                      ? "bg-green-50 text-green-600 border border-green-100"
                      : "bg-blue-50 text-blue-600 border border-blue-100"
                }`}
              >
                {saveStatus.message}
              </div>
            )}

            <button
              onClick={handleSaveToSheets}
              disabled={isSaving || history.length === 0}
              className="bg-black text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 px-6 py-2.5 rounded font-medium text-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-black w-fit"
            >
              {isSaving ? "Saving..." : "Save Results Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return <DuffyGame />;
}

export default App;
