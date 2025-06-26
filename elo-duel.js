/* global csLib */    // provided by CommunityScriptsUILibrary
(() => {
  /* ----------------------------- config ----------------------------- */
  const ROUTE = "/elo-duel";       // visit http(s)://stash.local/#/elo-duel
  const K     = 32;                // Elo K-factor
  const PER_PAGE = 500;            // how many performers to pull per reload

  /* -------------------------- GraphQL bits -------------------------- */
  const QUERY = `
    query ($n:Int!) {
      performers(filter:{ per_page:$n }) {
        id name image_path custom_fields
      }
    }`;

  const UPDATE = `
    mutation ($id:ID!, $elo:Float!) {
      performerUpdate(
        input:{
          id:$id
          custom_fields:{ eloRating:$elo }
          custom_fields_mode:PARTIAL     # keep any other custom fields
        }) { id }
    }`;

  /** Convenience: run a GQL query/mutation  */
  async function gql(query, variables) {
    return csLib.executeGQL(query, variables).then(r => r.data);
  }

  /* --------------------------- Elo maths ---------------------------- */
  function expected(win, lose) {
    return 1 / (1 + 10 ** ((lose - win) / 400));
  }

  async function vote(winner, loser) {
    const exp   = expected(winner.elo, loser.elo);
    const delta = Math.round(K * (1 - exp));

    await Promise.all([
      gql(UPDATE, { id: winner.id, elo: winner.elo + delta }),
      gql(UPDATE, { id: loser.id,  elo: loser.elo  - delta })
    ]);
    render();                       // reload a fresh pair
  }

  /* ----------------------- UI helper functions ---------------------- */
  function pickPair(list) {
    // shuffle, then sort by closeness of Elo so duels stay interesting
    const arr = list.slice().sort(() => Math.random() - 0.5);
    arr.sort((a, b) => Math.abs(a.elo - b.elo));
    return [arr[0], arr[1]];
  }

  function card(p, other) {
    const div = document.createElement("div");
    div.className =
      "w-64 cursor-pointer hover:scale-105 transition duration-150";
    div.innerHTML = `
      <img src="${p.image_path ?? ""}"
           style="width:100%;height:320px;object-fit:cover;border-radius:8px"/>
      <h3 style="text-align:center;margin-top:6px;font-weight:600">${p.name}</h3>
      <p style="font-size:12px;text-align:center;color:#888">Elo ${p.elo}</p>`;
    div.onclick = () => vote(p, other);
    return div;
  }

  /* --------------------------- Main render -------------------------- */
  async function render() {
    const root = document.getElementById("elo-duel-root") ||
                 document.body.appendChild(Object.assign(
                   document.createElement("div"),
                   { id: "elo-duel-root" }
                 ));

    root.innerHTML = "<p style='padding:1rem'>Loading performers…</p>";
    const data = await gql(QUERY, { n: PER_PAGE });

    const performers = data.performers.map(p => ({
      ...p,
      elo: Number(p.custom_fields?.eloRating ?? 1000)
    }));
    if (performers.length < 2) {
      root.innerHTML = "<p>Need at least two performers in the library.</p>";
      return;
    }
    const [a, b] = pickPair(performers);

    root.innerHTML = "";
    root.style.display = "flex";
    root.style.gap     = "2rem";
    root.style.justifyContent = "center";
    root.style.paddingTop     = "2rem";
    root.append(card(a, b));
    root.append(card(b, a));
  }

  /* ------------------------- Route listener ------------------------- */
  csLib.PathElementListener(ROUTE, () => {
    // Add nav entry the first time we land here
    if (!document.querySelector(`[data-elo-nav]`)) {
      const nav = document.querySelector("nav.sidebar") ||
                  document.querySelector(".Sidebar"); // v0.27 vs v0.28
      if (nav) {
        const a = document.createElement("a");
        a.dataset.eloNav = "1";
        a.href  = `#${ROUTE}`;
        a.textContent = "Elo Duel";
        a.style.display = "block";
        a.style.padding = "8px 16px";
        nav.appendChild(a);
      }
    }
    render();
  });

})();