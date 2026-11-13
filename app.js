// ===== Pokémon Card Portfolio Tracker v3 — Full OCR + All Pokémon =====

const STORAGE_KEY = 'pokemon_portfolio';
const API_BASE = 'https://api.pokemontcg.io/v2/cards';

// ===== State =====
let portfolio = loadPortfolio();
let selectedCard = null;
let editingCardId = null;

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    statCount: $('#stat-count'),
    statMarket: $('#stat-market'),
    statCost: $('#stat-cost'),
    statProfit: $('#stat-profit'),
    cardGrid: $('#card-grid'),
    emptyState: $('#empty-state'),
    searchInput: $('#search-input'),
    sortSelect: $('#sort-select'),
    modalAdd: $('#modal-add'),
    modalAddClose: $('#modal-add-close'),
    btnAddCard: $('#btn-add-card'),
    stepUpload: $('#step-upload'),
    stepSelect: $('#step-select'),
    stepConfirm: $('#step-confirm'),
    uploadArea: $('#upload-area'),
    fileInput: $('#file-input'),
    uploadPlaceholder: $('#upload-placeholder'),
    uploadPreview: $('#upload-preview'),
    ocrStatus: $('#ocr-status'),
    ocrStatusText: $('#ocr-status-text'),
    manualSearchInput: $('#manual-search-input'),
    btnManualSearch: $('#btn-manual-search'),
    searchResults: $('#search-results'),
    searchLoading: $('#search-loading'),
    searchEmpty: $('#search-empty'),
    btnBackUpload: $('#btn-back-upload'),
    confirmImage: $('#confirm-image'),
    confirmName: $('#confirm-name'),
    confirmSet: $('#confirm-set'),
    confirmRarity: $('#confirm-rarity'),
    confirmNumber: $('#confirm-number'),
    confirmMarketPrice: $('#confirm-market-price'),
    buyPrice: $('#buy-price'),
    manualMarketPrice: $('#manual-market-price'),
    marketPriceHint: $('#market-price-hint'),
    btnConfirmAdd: $('#btn-confirm-add'),
    btnBackSelect: $('#btn-back-select'),
    modalEdit: $('#modal-edit'),
    modalEditClose: $('#modal-edit-close'),
    editImage: $('#edit-image'),
    editName: $('#edit-name'),
    editSet: $('#edit-set'),
    editBuyPrice: $('#edit-buy-price'),
    editMarketPrice: $('#edit-market-price'),
    btnEditSave: $('#btn-edit-save'),
    btnEditDelete: $('#btn-edit-delete'),
    btnRefreshPrices: $('#btn-refresh-prices'),
    refreshOverlay: $('#refresh-overlay'),
    refreshProgress: $('#refresh-progress'),
    refreshStatus: $('#refresh-status'),
    toast: $('#toast'),
};

// ===== Storage =====
function loadPortfolio() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function savePortfolio() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

// ===== Formatting =====
function formatEuro(value) {
    if (value == null || isNaN(value)) return '—';
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function formatPercent(value) {
    if (value == null || isNaN(value) || !isFinite(value)) return '';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

// ===== Dashboard =====
function updateDashboard() {
    const count = portfolio.length;
    let totalMarket = 0;
    let totalCost = 0;

    portfolio.forEach(card => {
        totalMarket += card.marketPrice || 0;
        totalCost += card.buyPrice || 0;
    });

    const totalProfit = totalMarket - totalCost;

    dom.statCount.textContent = count;
    dom.statMarket.textContent = formatEuro(totalMarket);
    dom.statCost.textContent = formatEuro(totalCost);
    dom.statProfit.textContent = formatEuro(totalProfit);

    dom.statProfit.className = 'stat-value';
    if (totalProfit > 0.01) dom.statProfit.classList.add('profit');
    else if (totalProfit < -0.01) dom.statProfit.classList.add('loss');
}

// ===== Render Cards =====
function renderCards() {
    const filter = dom.searchInput.value.toLowerCase().trim();
    const sort = dom.sortSelect.value;

    let cards = [...portfolio];

    if (filter) {
        cards = cards.filter(c =>
            c.name.toLowerCase().includes(filter) ||
            (c.set || '').toLowerCase().includes(filter) ||
            (c.number || '').toLowerCase().includes(filter)
        );
    }

    cards.sort((a, b) => {
        switch (sort) {
            case 'date-desc': return (b.addedAt || 0) - (a.addedAt || 0);
            case 'date-asc': return (a.addedAt || 0) - (b.addedAt || 0);
            case 'name-asc': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            case 'profit-desc': return getProfit(b) - getProfit(a);
            case 'profit-asc': return getProfit(a) - getProfit(b);
            case 'value-desc': return (b.marketPrice || 0) - (a.marketPrice || 0);
            case 'value-asc': return (a.marketPrice || 0) - (b.marketPrice || 0);
            default: return 0;
        }
    });

    dom.cardGrid.innerHTML = '';

    if (cards.length === 0 && portfolio.length === 0) {
        dom.emptyState.style.display = '';
        return;
    }

    dom.emptyState.style.display = 'none';

    if (cards.length === 0) {
        dom.cardGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:3rem;">Keine Karten für diese Suche gefunden.</p>';
        return;
    }

    cards.forEach((card, i) => {
        const profit = getProfit(card);
        const profitClass = profit > 0.01 ? 'positive' : profit < -0.01 ? 'negative' : 'neutral';
        const percentChange = card.buyPrice > 0 ? ((profit / card.buyPrice) * 100) : 0;
        const hasManualPrice = card.manualMarketPrice && card.marketPrice > 0;

        const el = document.createElement('div');
        el.className = 'portfolio-card';
        el.style.animationDelay = `${i * 0.05}s`;
        el.dataset.id = card.id;
        el.innerHTML = `
            <div class="portfolio-card-image">
                <img src="${card.imageUrl}" alt="${card.name}" loading="lazy"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22><rect fill=%22%23161b2e%22 width=%22200%22 height=%22280%22 rx=%228%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%234a5568%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2213%22>Kein Bild</text></svg>'">
                ${card.rarity ? `<span class="portfolio-card-rarity">${card.rarity}</span>` : ''}
            </div>
            <div class="portfolio-card-body">
                <div class="portfolio-card-name">${card.name}</div>
                <div class="portfolio-card-set">${card.set || ''}${card.number ? ' · #' + card.number : ''}</div>
                <div class="portfolio-card-prices">
                    <div class="price-block">
                        <span class="price-label">Kaufpreis</span>
                        <span class="price-value">${formatEuro(card.buyPrice)}</span>
                    </div>
                    <div class="price-block">
                        <span class="price-label">Marktwert${hasManualPrice ? ' ✎' : ''}</span>
                        <span class="price-value market">${formatEuro(card.marketPrice)}</span>
                    </div>
                </div>
                <div class="portfolio-card-profit">
                    <span class="profit-badge ${profitClass}">${profit >= 0 ? '+' : ''}${formatEuro(profit)}</span>
                    <span class="profit-percent">${formatPercent(percentChange)}</span>
                </div>
            </div>
        `;

        el.addEventListener('click', () => openEditModal(card.id));
        dom.cardGrid.appendChild(el);
    });
}

function getProfit(card) {
    return (card.marketPrice || 0) - (card.buyPrice || 0);
}

// =====================================================================
// COMPLETE POKÉMON NAME DATABASE — German → English for API Search
// Also includes English names mapping to themselves.
// =====================================================================

const pokemonNames = {
    // --- Generation 1 (Kanto #001-151) ---
    'bisasam':'Bulbasaur','bulbasaur':'Bulbasaur','bisaknosp':'Ivysaur','ivysaur':'Ivysaur',
    'bisaflor':'Venusaur','venusaur':'Venusaur','glumanda':'Charmander','charmander':'Charmander',
    'glutexo':'Charmeleon','charmeleon':'Charmeleon','glurak':'Charizard','charizard':'Charizard',
    'schiggy':'Squirtle','squirtle':'Squirtle','schillok':'Wartortle','wartortle':'Wartortle',
    'turtok':'Blastoise','blastoise':'Blastoise','raupy':'Caterpie','caterpie':'Caterpie',
    'safcon':'Metapod','metapod':'Metapod','smettbo':'Butterfree','butterfree':'Butterfree',
    'hornliu':'Weedle','weedle':'Weedle','kokuna':'Kakuna','kakuna':'Kakuna',
    'bibor':'Beedrill','beedrill':'Beedrill','taubsi':'Pidgey','pidgey':'Pidgey',
    'tauboga':'Pidgeotto','pidgeotto':'Pidgeotto','tauboss':'Pidgeot','pidgeot':'Pidgeot',
    'rattfratz':'Rattata','rattata':'Rattata','rattikarl':'Raticate','raticate':'Raticate',
    'habitak':'Spearow','spearow':'Spearow','ibitak':'Fearow','fearow':'Fearow',
    'rettan':'Ekans','ekans':'Ekans','arbok':'Arbok',
    'pikachu':'Pikachu','raichu':'Raichu',
    'sandan':'Sandshrew','sandshrew':'Sandshrew','sandamer':'Sandslash','sandslash':'Sandslash',
    'nidoran':'Nidoran','nidorina':'Nidorina','nidoqueen':'Nidoqueen',
    'nidorino':'Nidorino','nidoking':'Nidoking',
    'piepi':'Clefairy','clefairy':'Clefairy','pixi':'Clefable','clefable':'Clefable',
    'vulpix':'Vulpix','vulnona':'Ninetales','ninetales':'Ninetales',
    'pummeluff':'Jigglypuff','jigglypuff':'Jigglypuff','knuddeluff':'Wigglytuff','wigglytuff':'Wigglytuff',
    'zubat':'Zubat','golbat':'Golbat',
    'myrapla':'Oddish','oddish':'Oddish','duflor':'Gloom','gloom':'Gloom',
    'giflor':'Vileplume','vileplume':'Vileplume','paras':'Paras','parasek':'Parasect','parasect':'Parasect',
    'bluzuk':'Venonat','venonat':'Venonat','omot':'Venomoth','venomoth':'Venomoth',
    'digda':'Diglett','diglett':'Diglett','digdri':'Dugtrio','dugtrio':'Dugtrio',
    'mauzi':'Meowth','meowth':'Meowth','snobilikat':'Persian','persian':'Persian',
    'enton':'Psyduck','psyduck':'Psyduck','entoron':'Golduck','golduck':'Golduck',
    'menki':'Mankey','mankey':'Mankey','rasaff':'Primeape','primeape':'Primeape',
    'fukano':'Growlithe','growlithe':'Growlithe','arkani':'Arcanine','arcanine':'Arcanine',
    'quapsel':'Poliwag','poliwag':'Poliwag','quaputzi':'Poliwhirl','poliwhirl':'Poliwhirl',
    'quappo':'Poliwrath','poliwrath':'Poliwrath',
    'abra':'Abra','kadabra':'Kadabra','simsala':'Alakazam','alakazam':'Alakazam',
    'machollo':'Machop','machop':'Machop','maschock':'Machoke','machoke':'Machoke',
    'machomei':'Machamp','machamp':'Machamp',
    'ultrigaria':'Bellsprout','bellsprout':'Bellsprout','sarzenia':'Weepinbell','weepinbell':'Weepinbell',
    'turtok':'Blastoise',
    'tentacha':'Tentacool','tentacool':'Tentacool','tentoxa':'Tentacruel','tentacruel':'Tentacruel',
    'kleinstein':'Geodude','geodude':'Geodude','georok':'Graveler','graveler':'Graveler',
    'geowaz':'Golem','golem':'Golem',
    'ponita':'Ponyta','ponyta':'Ponyta','gallopa':'Rapidash','rapidash':'Rapidash',
    'flegmon':'Slowpoke','slowpoke':'Slowpoke','lahmus':'Slowbro','slowbro':'Slowbro',
    'magnetilo':'Magnemite','magnemite':'Magnemite','magneton':'Magneton',
    'porenta':"Farfetch'd",'farfetchd':"Farfetch'd",
    'dodu':'Doduo','doduo':'Doduo','dodri':'Dodrio','dodrio':'Dodrio',
    'jurob':'Seel','seel':'Seel','jugong':'Dewgong','dewgong':'Dewgong',
    'sleima':'Grimer','grimer':'Grimer','sleimok':'Muk','muk':'Muk',
    'muschas':'Shellder','shellder':'Shellder','austos':'Cloyster','cloyster':'Cloyster',
    'nebulak':'Gastly','gastly':'Gastly','alpollo':'Haunter','haunter':'Haunter','gengar':'Gengar',
    'onix':'Onix','traumato':'Drowzee','drowzee':'Drowzee','hypno':'Hypno',
    'krabby':'Krabby','kingler':'Kingler',
    'voltobal':'Voltorb','voltorb':'Voltorb','lektrobal':'Electrode','electrode':'Electrode',
    'owei':'Exeggcute','exeggcute':'Exeggcute','kokowei':'Exeggutor','exeggutor':'Exeggutor',
    'tragosso':'Cubone','cubone':'Cubone','knogga':'Marowak','marowak':'Marowak',
    'kicklee':'Hitmonlee','hitmonlee':'Hitmonlee','nockchan':'Hitmonchan','hitmonchan':'Hitmonchan',
    'schlurp':'Lickitung','lickitung':'Lickitung',
    'smogon':'Koffing','koffing':'Koffing','smogmog':'Weezing','weezing':'Weezing',
    'rihorn':'Rhyhorn','rhyhorn':'Rhyhorn','rizeros':'Rhydon','rhydon':'Rhydon',
    'chaneira':'Chansey','chansey':'Chansey','tangela':'Tangela',
    'kangama':'Kangaskhan','kangaskhan':'Kangaskhan',
    'seeper':'Horsea','horsea':'Horsea','seemon':'Seadra','seadra':'Seadra',
    'goldini':'Goldeen','goldeen':'Goldeen','golking':'Seaking','seaking':'Seaking',
    'sterndu':'Staryu','staryu':'Staryu','starmie':'Starmie',
    'pantimos':'Mr. Mime','mr. mime':'Mr. Mime','mr mime':'Mr. Mime',
    'sichlor':'Scyther','scyther':'Scyther','rossana':'Jynx','jynx':'Jynx',
    'elektek':'Electabuzz','electabuzz':'Electabuzz','magmar':'Magmar',
    'pinsir':'Pinsir','tauros':'Tauros',
    'karpador':'Magikarp','magikarp':'Magikarp','garados':'Gyarados','gyarados':'Gyarados',
    'lapras':'Lapras','ditto':'Ditto',
    'evoli':'Eevee','eevee':'Eevee',
    'aquana':'Vaporeon','vaporeon':'Vaporeon','blitza':'Jolteon','jolteon':'Jolteon',
    'flamara':'Flareon','flareon':'Flareon','porygon':'Porygon',
    'amonitas':'Omanyte','omanyte':'Omanyte','amoroso':'Omastar','omastar':'Omastar',
    'kabuto':'Kabuto','kabutops':'Kabutops','aerodactyl':'Aerodactyl',
    'relaxo':'Snorlax','snorlax':'Snorlax',
    'arktos':'Articuno','articuno':'Articuno','zapdos':'Zapdos',
    'lavados':'Moltres','moltres':'Moltres',
    'dratini':'Dratini','dragonir':'Dragonair','dragonair':'Dragonair',
    'dragoran':'Dragonite','dragonite':'Dragonite',
    'mewtu':'Mewtwo','mewtwo':'Mewtwo','mew':'Mew',

    // --- Generation 2 (Johto #152-251) ---
    'endivie':'Chikorita','chikorita':'Chikorita','lorblatt':'Bayleef','bayleef':'Bayleef',
    'meganie':'Meganium','meganium':'Meganium',
    'feurigel':'Cyndaquil','cyndaquil':'Cyndaquil','igelavar':'Quilava','quilava':'Quilava',
    'tornupto':'Typhlosion','typhlosion':'Typhlosion',
    'karnimani':'Totodile','totodile':'Totodile','tyracroc':'Croconaw','croconaw':'Croconaw',
    'impergator':'Feraligatr','feraligatr':'Feraligatr',
    'wiesor':'Sentret','sentret':'Sentret','wiesenior':'Furret','furret':'Furret',
    'hoothoot':'Hoothoot','noctuh':'Noctowl','noctowl':'Noctowl',
    'ledyba':'Ledyba','ledian':'Ledian',
    'webarak':'Spinarak','spinarak':'Spinarak','ariados':'Ariados',
    'iksbat':'Crobat','crobat':'Crobat',
    'lampi':'Chinchou','chinchou':'Chinchou','lanturn':'Lanturn',
    'pichu':'Pichu','pii':'Cleffa','cleffa':'Cleffa',
    'fluffeluff':'Igglybuff','igglybuff':'Igglybuff',
    'togepi':'Togepi','togetic':'Togetic',
    'natu':'Natu','xatu':'Xatu',
    'voltilamm':'Mareep','mareep':'Mareep','waaty':'Flaaffy','flaaffy':'Flaaffy',
    'ampharos':'Ampharos','blubella':'Bellossom','bellossom':'Bellossom',
    'marill':'Marill','azumarill':'Azumarill',
    'mogelbaum':'Sudowoodo','sudowoodo':'Sudowoodo','quaxo':'Politoed','politoed':'Politoed',
    'hoppspross':'Hoppip','hoppip':'Hoppip','hubelupf':'Skiploom','skiploom':'Skiploom',
    'papungha':'Jumpluff','jumpluff':'Jumpluff',
    'griffel':'Aipom','aipom':'Aipom','sonnkern':'Sunkern','sunkern':'Sunkern',
    'sonnflora':'Sunflora','sunflora':'Sunflora','yanma':'Yanma',
    'felino':'Wooper','wooper':'Wooper','morlord':'Quagsire','quagsire':'Quagsire',
    'psiana':'Espeon','espeon':'Espeon','nachtara':'Umbreon','umbreon':'Umbreon',
    'kramurx':'Murkrow','murkrow':'Murkrow','laschoking':'Slowking','slowking':'Slowking',
    'traunfugil':'Misdreavus','misdreavus':'Misdreavus',
    'icognito':'Unown','unown':'Unown','woingenau':'Wobbuffet','wobbuffet':'Wobbuffet',
    'girafarig':'Girafarig','tannza':'Pineco','pineco':'Pineco',
    'forstellka':'Forretress','forretress':'Forretress',
    'dummisel':'Dunsparce','dunsparce':'Dunsparce',
    'skorgla':'Gligar','gligar':'Gligar','stahlos':'Steelix','steelix':'Steelix',
    'snubbull':'Snubbull','granbull':'Granbull',
    'baldorfish':'Qwilfish','qwilfish':'Qwilfish',
    'scherox':'Scizor','scizor':'Scizor','pottrott':'Shuckle','shuckle':'Shuckle',
    'skaraborn':'Heracross','heracross':'Heracross',
    'sniebel':'Sneasel','sneasel':'Sneasel',
    'teddiursa':'Teddiursa','ursaring':'Ursaring',
    'schneckmag':'Slugma','slugma':'Slugma','magcargo':'Magcargo',
    'quiekel':'Swinub','swinub':'Swinub','keifel':'Piloswine','piloswine':'Piloswine',
    'corasonn':'Corsola','corsola':'Corsola','remoraid':'Remoraid','octillery':'Octillery',
    'botogel':'Delibird','delibird':'Delibird','mantax':'Mantine','mantine':'Mantine',
    'panzaeron':'Skarmory','skarmory':'Skarmory',
    'hunduster':'Houndour','houndour':'Houndour','hundemon':'Houndoom','houndoom':'Houndoom',
    'seedraking':'Kingdra','kingdra':'Kingdra',
    'phanpy':'Phanpy','donphan':'Donphan','porygon2':'Porygon2',
    'damhirplex':'Stantler','stantler':'Stantler','farbeagle':'Smeargle','smeargle':'Smeargle',
    'rabauz':'Tyrogue','tyrogue':'Tyrogue','kapoera':'Hitmontop','hitmontop':'Hitmontop',
    'kussilla':'Smoochum','smoochum':'Smoochum','elekid':'Elekid','magby':'Magby',
    'miltank':'Miltank','heiteira':'Blissey','blissey':'Blissey',
    'raikou':'Raikou','entei':'Entei','suicune':'Suicune',
    'larvitar':'Larvitar','pupitar':'Pupitar','despotar':'Tyranitar','tyranitar':'Tyranitar',
    'lugia':'Lugia','ho-oh':'Ho-Oh','hooh':'Ho-Oh','celebi':'Celebi',

    // --- Generation 3 (Hoenn #252-386) ---
    'geckarbor':'Treecko','treecko':'Treecko','reptain':'Grovyle','grovyle':'Grovyle',
    'gewaldro':'Sceptile','sceptile':'Sceptile',
    'flemmli':'Torchic','torchic':'Torchic','jungglut':'Combusken','combusken':'Combusken',
    'lohgock':'Blaziken','blaziken':'Blaziken',
    'hydropi':'Mudkip','mudkip':'Mudkip','moorabbel':'Marshtomp','marshtomp':'Marshtomp',
    'sumpex':'Swampert','swampert':'Swampert',
    'zigzachs':'Zigzagoon','zigzagoon':'Zigzagoon','geradaks':'Linoone','linoone':'Linoone',
    'waumpel':'Wurmple','wurmple':'Wurmple','schaloko':'Silcoon','silcoon':'Silcoon',
    'papinella':'Beautifly','beautifly':'Beautifly','panekon':'Cascoon','cascoon':'Cascoon',
    'pudox':'Dustox','dustox':'Dustox',
    'loturzel':'Lotad','lotad':'Lotad','lombrero':'Lombre','lombre':'Lombre',
    'kappalores':'Ludicolo','ludicolo':'Ludicolo',
    'samurzel':'Seedot','seedot':'Seedot','blanas':'Nuzleaf','nuzleaf':'Nuzleaf',
    'tengulist':'Shiftry','shiftry':'Shiftry',
    'schwalbini':'Taillow','taillow':'Taillow','schwalboss':'Swellow','swellow':'Swellow',
    'wingull':'Wingull','pelipper':'Pelipper',
    'trasla':'Ralts','ralts':'Ralts','kirlia':'Kirlia',
    'guardevoir':'Gardevoir','gardevoir':'Gardevoir',
    'gehweiher':'Surskit','surskit':'Surskit','maskeregen':'Masquerain','masquerain':'Masquerain',
    'knilz':'Shroomish','shroomish':'Shroomish','kapilz':'Breloom','breloom':'Breloom',
    'bummelz':'Slakoth','slakoth':'Slakoth','muntier':'Vigoroth','vigoroth':'Vigoroth',
    'letarking':'Slaking','slaking':'Slaking',
    'nincada':'Nincada','ninjask':'Ninjask','ninjatom':'Shedinja','shedinja':'Shedinja',
    'flurmel':'Whismur','whismur':'Whismur','krakeelo':'Loudred','loudred':'Loudred',
    'krawumms':'Exploud','exploud':'Exploud',
    'makuhita':'Makuhita','hariyama':'Hariyama','azurill':'Azurill',
    'nasgnet':'Nosepass','nosepass':'Nosepass',
    'eneco':'Skitty','skitty':'Skitty','enekoro':'Delcatty','delcatty':'Delcatty',
    'zobiris':'Sableye','sableye':'Sableye','flunkifer':'Mawile','mawile':'Mawile',
    'stollunior':'Aron','aron':'Aron','stollrak':'Lairon','lairon':'Lairon',
    'stolloss':'Aggron','aggron':'Aggron',
    'meditie':'Meditite','meditite':'Meditite','medicham':'Medicham',
    'frizelbliz':'Electrike','electrike':'Electrike','voltenso':'Manectric','manectric':'Manectric',
    'plusle':'Plusle','minun':'Minun','volbeat':'Volbeat','illumise':'Illumise',
    'roselia':'Roselia',
    'schluppuck':'Gulpin','gulpin':'Gulpin','schlukwech':'Swalot','swalot':'Swalot',
    'kanivanha':'Carvanha','carvanha':'Carvanha','tohaido':'Sharpedo','sharpedo':'Sharpedo',
    'wailmer':'Wailmer','wailord':'Wailord',
    'camaub':'Numel','numel':'Numel','camerupt':'Camerupt',
    'qurtel':'Torkoal','torkoal':'Torkoal','spoink':'Spoink','groink':'Grumpig','grumpig':'Grumpig',
    'pandir':'Spinda','spinda':'Spinda',
    'knacklion':'Trapinch','trapinch':'Trapinch','vibrava':'Vibrava',
    'libelldra':'Flygon','flygon':'Flygon',
    'tuska':'Cacnea','cacnea':'Cacnea','noktuska':'Cacturne','cacturne':'Cacturne',
    'wablu':'Swablu','swablu':'Swablu','altaria':'Altaria',
    'sengo':'Zangoose','zangoose':'Zangoose','vipitis':'Seviper','seviper':'Seviper',
    'lunastein':'Lunatone','lunatone':'Lunatone','sonnfel':'Solrock','solrock':'Solrock',
    'schmerbe':'Barboach','barboach':'Barboach','welsar':'Whiscash','whiscash':'Whiscash',
    'krebscorps':'Corphish','corphish':'Corphish','krebutack':'Crawdaunt','crawdaunt':'Crawdaunt',
    'puppance':'Baltoy','baltoy':'Baltoy','lepumentas':'Claydol','claydol':'Claydol',
    'liliep':'Lileep','lileep':'Lileep','wielie':'Cradily','cradily':'Cradily',
    'anorith':'Anorith','armaldo':'Armaldo',
    'barschwa':'Feebas','feebas':'Feebas','milotic':'Milotic',
    'formeo':'Castform','castform':'Castform','kecleon':'Kecleon',
    'shuppet':'Shuppet','banette':'Banette',
    'zwirrlicht':'Duskull','duskull':'Duskull','zwirrklop':'Dusclops','dusclops':'Dusclops',
    'tropius':'Tropius','palimpalim':'Chimecho','chimecho':'Chimecho','absol':'Absol',
    'isso':'Wynaut','wynaut':'Wynaut',
    'schneppke':'Snorunt','snorunt':'Snorunt','firnontor':'Glalie','glalie':'Glalie',
    'seemops':'Spheal','spheal':'Spheal','seejong':'Sealeo','sealeo':'Sealeo',
    'walraisa':'Walrein','walrein':'Walrein',
    'perlu':'Clamperl','clamperl':'Clamperl','aalabyss':'Huntail','huntail':'Huntail',
    'saganabyss':'Gorebyss','gorebyss':'Gorebyss','relicanth':'Relicanth',
    'liebiskus':'Luvdisc','luvdisc':'Luvdisc',
    'kindwurm':'Bagon','bagon':'Bagon','draschel':'Shelgon','shelgon':'Shelgon',
    'brutalanda':'Salamence','salamence':'Salamence',
    'tanhel':'Beldum','beldum':'Beldum','metang':'Metang','metagross':'Metagross',
    'regirock':'Regirock','regice':'Regice','registeel':'Registeel',
    'latias':'Latias','latios':'Latios',
    'kyogre':'Kyogre','groudon':'Groudon','rayquaza':'Rayquaza',
    'jirachi':'Jirachi','deoxys':'Deoxys',

    // --- Generation 4 (Sinnoh #387-493) ---
    'chelast':'Turtwig','turtwig':'Turtwig','chelcarain':'Grotle','grotle':'Grotle',
    'chelterrar':'Torterra','torterra':'Torterra',
    'panflam':'Chimchar','chimchar':'Chimchar','panpyro':'Monferno','monferno':'Monferno',
    'panferno':'Infernape','infernape':'Infernape',
    'plinfa':'Piplup','piplup':'Piplup','pliprin':'Prinplup','prinplup':'Prinplup',
    'impoleon':'Empoleon','empoleon':'Empoleon',
    'staralili':'Starly','starly':'Starly','staravia':'Staravia','staraptor':'Staraptor',
    'bidiza':'Bidoof','bidoof':'Bidoof','bidifas':'Bibarel','bibarel':'Bibarel',
    'sheinux':'Shinx','shinx':'Shinx','luxio':'Luxio','luxtra':'Luxray','luxray':'Luxray',
    'knospi':'Budew','budew':'Budew','roserade':'Roserade',
    'koknodon':'Cranidos','cranidos':'Cranidos','rameidon':'Rampardos','rampardos':'Rampardos',
    'schilterus':'Shieldon','shieldon':'Shieldon','bollterus':'Bastiodon','bastiodon':'Bastiodon',
    'burmy':'Burmy','burmadame':'Wormadam','wormadam':'Wormadam',
    'moterpel':'Mothim','mothim':'Mothim',
    'wadribie':'Combee','combee':'Combee','honweisel':'Vespiquen','vespiquen':'Vespiquen',
    'pachirisu':'Pachirisu',
    'bamelin':'Buizel','buizel':'Buizel','bojelin':'Floatzel','floatzel':'Floatzel',
    'schalellos':'Shellos','shellos':'Shellos','gastrodon':'Gastrodon',
    'ambidiffel':'Ambipom','ambipom':'Ambipom',
    'driftlon':'Drifloon','drifloon':'Drifloon','drifzepeli':'Drifblim','drifblim':'Drifblim',
    'haspiror':'Buneary','buneary':'Buneary','schlapor':'Lopunny','lopunny':'Lopunny',
    'traunmagil':'Mismagius','mismagius':'Mismagius','kramshef':'Honchkrow','honchkrow':'Honchkrow',
    'charmian':'Glameow','glameow':'Glameow','shnurgarst':'Purugly','purugly':'Purugly',
    'klingplim':'Chingling','chingling':'Chingling',
    'skunkapuh':'Stunky','stunky':'Stunky','skuntank':'Skuntank',
    'bronzel':'Bronzor','bronzor':'Bronzor','bronzong':'Bronzong',
    'mobai':'Bonsly','bonsly':'Bonsly',
    'pantimimi':'Mime Jr.','mime jr.':'Mime Jr.','mime jr':'Mime Jr.',
    'wonneira':'Happiny','happiny':'Happiny','plaudagei':'Chatot','chatot':'Chatot',
    'kryppuk':'Spiritomb','spiritomb':'Spiritomb',
    'kaumalat':'Gible','gible':'Gible','knarksel':'Gabite','gabite':'Gabite',
    'knakrack':'Garchomp','garchomp':'Garchomp',
    'mampfaxo':'Munchlax','munchlax':'Munchlax',
    'riolu':'Riolu','lucario':'Lucario',
    'hippopotas':'Hippopotas','hippoterus':'Hippowdon','hippowdon':'Hippowdon',
    'pionskora':'Skorupi','skorupi':'Skorupi','piondragi':'Drapion','drapion':'Drapion',
    'glibunkel':'Croagunk','croagunk':'Croagunk','toxiquak':'Toxicroak','toxicroak':'Toxicroak',
    'venuflibis':'Carnivine','carnivine':'Carnivine',
    'finneon':'Finneon','lumineon':'Lumineon',
    'mantirps':'Mantyke','mantyke':'Mantyke',
    'shnebedeck':'Snover','snover':'Snover','rexblisar':'Abomasnow','abomasnow':'Abomasnow',
    'snibunna':'Weavile','weavile':'Weavile','magnezone':'Magnezone',
    'schlurplek':'Lickilicky','lickilicky':'Lickilicky',
    'rihornior':'Rhyperior','rhyperior':'Rhyperior','tangoloss':'Tangrowth','tangrowth':'Tangrowth',
    'elevoltek':'Electivire','electivire':'Electivire','magbrant':'Magmortar','magmortar':'Magmortar',
    'togekiss':'Togekiss','yanmega':'Yanmega',
    'folipurba':'Leafeon','leafeon':'Leafeon','glaziola':'Glaceon','glaceon':'Glaceon',
    'skorgro':'Gliscor','gliscor':'Gliscor','mamutel':'Mamoswine','mamoswine':'Mamoswine',
    'porygon-z':'Porygon-Z','porygonz':'Porygon-Z',
    'galagladi':'Gallade','gallade':'Gallade','voluminas':'Probopass','probopass':'Probopass',
    'zwirrfinst':'Dusknoir','dusknoir':'Dusknoir','frosdedje':'Froslass','froslass':'Froslass',
    'rotom':'Rotom',
    'selfe':'Uxie','uxie':'Uxie','vesprit':'Mesprit','mesprit':'Mesprit',
    'tobutz':'Azelf','azelf':'Azelf',
    'dialga':'Dialga','palkia':'Palkia','heatran':'Heatran','regigigas':'Regigigas',
    'giratina':'Giratina','cresselia':'Cresselia',
    'phione':'Phione','manaphy':'Manaphy','darkrai':'Darkrai','shaymin':'Shaymin','arceus':'Arceus',

    // --- Generation 5 (Unova #494-649) ---
    'victini':'Victini',
    'serpifeu':'Snivy','snivy':'Snivy','efoserp':'Servine','servine':'Servine',
    'serpiroyal':'Serperior','serperior':'Serperior',
    'floink':'Tepig','tepig':'Tepig','ferkokel':'Pignite','pignite':'Pignite',
    'flambirex':'Emboar','emboar':'Emboar',
    'ottaro':'Oshawott','oshawott':'Oshawott','zwottronin':'Dewott','dewott':'Dewott',
    'admurai':'Samurott','samurott':'Samurott',
    'yorkleff':'Lillipup','lillipup':'Lillipup','terribark':'Herdier','herdier':'Herdier',
    'bissbark':'Stoutland','stoutland':'Stoutland',
    'felilou':'Purrloin','purrloin':'Purrloin','kleoparda':'Liepard','liepard':'Liepard',
    'vegimak':'Pansage','pansage':'Pansage','vegichita':'Simisage','simisage':'Simisage',
    'grillmak':'Pansear','pansear':'Pansear','grillchita':'Simisear','simisear':'Simisear',
    'sodamak':'Panpour','panpour':'Panpour','sodachita':'Simipour','simipour':'Simipour',
    'somniam':'Munna','munna':'Munna','somnivora':'Musharna','musharna':'Musharna',
    'dusselgurr':'Pidove','pidove':'Pidove','navitaub':'Tranquill','tranquill':'Tranquill',
    'fasasnob':'Unfezant','unfezant':'Unfezant',
    'elezeba':'Blitzle','blitzle':'Blitzle','zebritz':'Zebstrika','zebstrika':'Zebstrika',
    'kiesling':'Roggenrola','roggenrola':'Roggenrola','sedimantur':'Boldore','boldore':'Boldore',
    'brockoloss':'Gigalith','gigalith':'Gigalith',
    'fleknoil':'Woobat','woobat':'Woobat','fletiamo':'Swoobat','swoobat':'Swoobat',
    'rotomurf':'Drilbur','drilbur':'Drilbur','stalobor':'Excadrill','excadrill':'Excadrill',
    'ohrdoch':'Audino','audino':'Audino',
    'praktibalk':'Timburr','timburr':'Timburr','strepoli':'Gurdurr','gurdurr':'Gurdurr',
    'meistagrif':'Conkeldurr','conkeldurr':'Conkeldurr',
    'schallquap':'Tympole','tympole':'Tympole','mebrana':'Palpitoad','palpitoad':'Palpitoad',
    'branawarz':'Seismitoad','seismitoad':'Seismitoad',
    'jiutesto':'Throh','throh':'Throh','karadonis':'Sawk','sawk':'Sawk',
    'strawickl':'Sewaddle','sewaddle':'Sewaddle','folikon':'Swadloon','swadloon':'Swadloon',
    'matrifol':'Leavanny','leavanny':'Leavanny',
    'toxiped':'Venipede','venipede':'Venipede','rollum':'Whirlipede','whirlipede':'Whirlipede',
    'cerapendra':'Scolipede','scolipede':'Scolipede',
    'waumboll':'Cottonee','cottonee':'Cottonee','elfun':'Whimsicott','whimsicott':'Whimsicott',
    'lilminip':'Petilil','petilil':'Petilil','dressella':'Lilligant','lilligant':'Lilligant',
    'barschuft':'Basculin','basculin':'Basculin',
    'ganovil':'Sandile','sandile':'Sandile','rokkaiman':'Krokorok','krokorok':'Krokorok',
    'rabigator':'Krookodile','krookodile':'Krookodile',
    'flampion':'Darumaka','darumaka':'Darumaka','flampivian':'Darmanitan','darmanitan':'Darmanitan',
    'maracamba':'Maractus','maractus':'Maractus',
    'lithomith':'Dwebble','dwebble':'Dwebble','castellith':'Crustle','crustle':'Crustle',
    'zurrokex':'Scraggy','scraggy':'Scraggy','irokex':'Scrafty','scrafty':'Scrafty',
    'symvolara':'Sigilyph','sigilyph':'Sigilyph',
    'makabaja':'Yamask','yamask':'Yamask','echnatoll':'Cofagrigus','cofagrigus':'Cofagrigus',
    'galapaflos':'Tirtouga','tirtouga':'Tirtouga','karippas':'Carracosta','carracosta':'Carracosta',
    'flapteryx':'Archen','archen':'Archen','aeropteryx':'Archeops','archeops':'Archeops',
    'unratütox':'Trubbish','trubbish':'Trubbish','deponitox':'Garbodor','garbodor':'Garbodor',
    'zorua':'Zorua','zoroark':'Zoroark',
    'picochilla':'Minccino','minccino':'Minccino','chillabell':'Cinccino','cinccino':'Cinccino',
    'mollimorba':'Gothita','gothita':'Gothita','hypnomorba':'Gothorita','gothorita':'Gothorita',
    'morbitesse':'Gothitelle','gothitelle':'Gothitelle',
    'monozyto':'Solosis','solosis':'Solosis','mitodos':'Duosion','duosion':'Duosion',
    'zytomega':'Reuniclus','reuniclus':'Reuniclus',
    'piccolente':'Ducklett','ducklett':'Ducklett','swaroness':'Swanna','swanna':'Swanna',
    'gelatini':'Vanillite','vanillite':'Vanillite','gelatroppo':'Vanillish','vanillish':'Vanillish',
    'gelatwino':'Vanilluxe','vanilluxe':'Vanilluxe',
    'sesokitz':'Deerling','deerling':'Deerling','kronjuwild':'Sawsbuck','sawsbuck':'Sawsbuck',
    'emolga':'Emolga',
    'laukaps':'Karrablast','karrablast':'Karrablast','cavalanzas':'Escavalier','escavalier':'Escavalier',
    'tarnpignon':'Foongus','foongus':'Foongus','hutsassa':'Amoonguss','amoonguss':'Amoonguss',
    'quabbel':'Frillish','frillish':'Frillish','apoquallyp':'Jellicent','jellicent':'Jellicent',
    'mamolida':'Alomomola','alomomola':'Alomomola',
    'wattzapf':'Joltik','joltik':'Joltik','voltula':'Galvantula','galvantula':'Galvantula',
    'kastadur':'Ferroseed','ferroseed':'Ferroseed','tentantel':'Ferrothorn','ferrothorn':'Ferrothorn',
    'klikk':'Klink','klink':'Klink','kliklak':'Klang','klang':'Klang',
    'klikdiklak':'Klinklang','klinklang':'Klinklang',
    'zapplardin':'Tynamo','tynamo':'Tynamo','zapplalek':'Eelektrik','eelektrik':'Eelektrik',
    'zapplarang':'Eelektross','eelektross':'Eelektross',
    'pygraulon':'Elgyem','elgyem':'Elgyem','megalon':'Beheeyem','beheeyem':'Beheeyem',
    'lichtel':'Litwick','litwick':'Litwick','laternecto':'Lampent','lampent':'Lampent',
    'skelabra':'Chandelure','chandelure':'Chandelure',
    'milza':'Axew','axew':'Axew','sharfax':'Fraxure','fraxure':'Fraxure',
    'maxax':'Haxorus','haxorus':'Haxorus',
    'petznief':'Cubchoo','cubchoo':'Cubchoo','siberio':'Beartic','beartic':'Beartic',
    'frigometri':'Cryogonal','cryogonal':'Cryogonal',
    'schnuthelm':'Shelmet','shelmet':'Shelmet','hydragil':'Accelgor','accelgor':'Accelgor',
    'flunschlik':'Stunfisk','stunfisk':'Stunfisk',
    'lin-fu':'Mienfoo','mienfoo':'Mienfoo','wie-shu':'Mienshao','mienshao':'Mienshao',
    'shardrago':'Druddigon','druddigon':'Druddigon',
    'golbit':'Golett','golett':'Golett','golgantes':'Golurk','golurk':'Golurk',
    'gladiantri':'Pawniard','pawniard':'Pawniard','caesurio':'Bisharp','bisharp':'Bisharp',
    'bisofank':'Bouffalant','bouffalant':'Bouffalant',
    'geronimatz':'Rufflet','rufflet':'Rufflet','washakwil':'Braviary','braviary':'Braviary',
    'skallyk':'Vullaby','vullaby':'Vullaby','grypheldis':'Mandibuzz','mandibuzz':'Mandibuzz',
    'thermopod':'Heatmor','heatmor':'Heatmor','fermicula':'Durant','durant':'Durant',
    'kapuno':'Deino','deino':'Deino','duodino':'Zweilous','zweilous':'Zweilous',
    'trikephalo':'Hydreigon','hydreigon':'Hydreigon',
    'ignivor':'Larvesta','larvesta':'Larvesta','ramoth':'Volcarona','volcarona':'Volcarona',
    'kobalium':'Cobalion','cobalion':'Cobalion','terrakium':'Terrakion','terrakion':'Terrakion',
    'viridium':'Virizion','virizion':'Virizion',
    'boreos':'Tornadus','tornadus':'Tornadus','voltolos':'Thundurus','thundurus':'Thundurus',
    'reshiram':'Reshiram','zekrom':'Zekrom',
    'demeteros':'Landorus','landorus':'Landorus','kyurem':'Kyurem',
    'keldeo':'Keldeo','meloetta':'Meloetta','genesect':'Genesect',

    // --- Generation 6 (Kalos #650-721) ---
    'igamaro':'Chespin','chespin':'Chespin','igastarnish':'Quilladin','quilladin':'Quilladin',
    'brigaron':'Chesnaught','chesnaught':'Chesnaught',
    'fynx':'Fennekin','fennekin':'Fennekin','rutena':'Braixen','braixen':'Braixen',
    'fennexis':'Delphox','delphox':'Delphox',
    'froxy':'Froakie','froakie':'Froakie','amphizel':'Frogadier','frogadier':'Frogadier',
    'quajutsu':'Greninja','greninja':'Greninja',
    'dartiri':'Fletchling','fletchling':'Fletchling','dartignis':'Fletchinder','fletchinder':'Fletchinder',
    'fiaro':'Talonflame','talonflame':'Talonflame',
    'vivillon':'Vivillon',
    'leufeo':'Litleo','litleo':'Litleo','pyroleo':'Pyroar','pyroar':'Pyroar',
    'flabebe':'Flabébé',
    'feelinara':'Sylveon','sylveon':'Sylveon',
    'resladero':'Hawlucha','hawlucha':'Hawlucha','dedenne':'Dedenne',
    'viscora':'Goomy','goomy':'Goomy','viscargot':'Sliggoo','sliggoo':'Sliggoo',
    'viscogon':'Goodra','goodra':'Goodra',
    'clavion':'Klefki','klefki':'Klefki',
    'paragoni':'Phantump','phantump':'Phantump','trombork':'Trevenant','trevenant':'Trevenant',
    'irrbis':'Pumpkaboo','pumpkaboo':'Pumpkaboo','pumpdjinn':'Gourgeist','gourgeist':'Gourgeist',
    'uhafnir':'Noivern','noivern':'Noivern',
    'xerneas':'Xerneas','yveltal':'Yveltal','zygarde':'Zygarde',
    'diancie':'Diancie','hoopa':'Hoopa','volcanion':'Volcanion',
    'durengard':'Aegislash','aegislash':'Aegislash',
    'gramokles':'Honedge','honedge':'Honedge','duokles':'Doublade','doublade':'Doublade',

    // --- Generation 7 (Alola #722-809) ---
    'bauz':'Rowlet','rowlet':'Rowlet','aruz':'Dartrix','dartrix':'Dartrix',
    'silvarro':'Decidueye','decidueye':'Decidueye',
    'flamiau':'Litten','litten':'Litten','miezunder':'Torracat','torracat':'Torracat',
    'fuegro':'Incineroar','incineroar':'Incineroar',
    'robball':'Popplio','popplio':'Popplio','marikeck':'Brionne','brionne':'Brionne',
    'primarene':'Primarina','primarina':'Primarina',
    'wuffels':'Rockruff','rockruff':'Rockruff','wolwerock':'Lycanroc','lycanroc':'Lycanroc',
    'lusardin':'Wishiwashi','wishiwashi':'Wishiwashi',
    'garstella':'Mareanie','mareanie':'Mareanie','aggrostella':'Toxapex','toxapex':'Toxapex',
    'mimigma':'Mimikyu','mimikyu':'Mimikyu',
    'cosmog':'Cosmog','cosmovum':'Cosmoem','cosmoem':'Cosmoem',
    'solgaleo':'Solgaleo','lunala':'Lunala',
    'necrozma':'Necrozma','magearna':'Magearna','marshadow':'Marshadow',
    'venicro':'Poipole','poipole':'Poipole','agoyon':'Naganadel','naganadel':'Naganadel',
    'zeraora':'Zeraora','meltan':'Meltan','melmetal':'Melmetal',
    'donarion':'Vikavolt','vikavolt':'Vikavolt',
    'molunk':'Salandit','salandit':'Salandit','amfira':'Salazzle','salazzle':'Salazzle',
    'velursi':'Stufful','stufful':'Stufful','kosturso':'Bewear','bewear':'Bewear',
    'fruyal':'Tsareena','tsareena':'Tsareena',
    'tectass':'Golisopod','golisopod':'Golisopod',
    'sankabuh':'Sandygast','sandygast':'Sandygast','colossand':'Palossand','palossand':'Palossand',
    'amigento':'Silvally','silvally':'Silvally',
    'togedemaru':'Togedemaru','dhelmise':'Dhelmise',
    'miniras':'Jangmo-o','jangmoo':'Jangmo-o','mediras':'Hakamo-o','hakamoo':'Hakamo-o',
    'grandiras':'Kommo-o','kommoo':'Kommo-o',
    'tortunator':'Turtonator','turtonator':'Turtonator',

    // --- Generation 8 (Galar #810-898) ---
    'chimpep':'Grookey','grookey':'Grookey','chimstix':'Thwackey','thwackey':'Thwackey',
    'gortrom':'Rillaboom','rillaboom':'Rillaboom',
    'hopplo':'Scorbunny','scorbunny':'Scorbunny','kickerlo':'Raboot','raboot':'Raboot',
    'liberlo':'Cinderace','cinderace':'Cinderace',
    'memmeon':'Sobble','sobble':'Sobble','phlegleon':'Drizzile','drizzile':'Drizzile',
    'intelleon':'Inteleon','inteleon':'Inteleon',
    'krarmor':'Corviknight','corviknight':'Corviknight',
    'wolly':'Wooloo','wooloo':'Wooloo',
    'toxel':'Toxel','riffex':'Toxtricity','toxtricity':'Toxtricity',
    'olangaar':'Grimmsnarl','grimmsnarl':'Grimmsnarl',
    'barrikadax':'Obstagoon','obstagoon':'Obstagoon',
    'silembrim':'Hatterene','hatterene':'Hatterene',
    'morpeko':'Morpeko',
    'duraludon':'Duraludon',
    'katapuldra':'Dragapult','dragapult':'Dragapult',
    'zacian':'Zacian','zamazenta':'Zamazenta',
    'endynalos':'Eternatus','eternatus':'Eternatus',
    'dakuma':'Kubfu','kubfu':'Kubfu','wulaosu':'Urshifu','urshifu':'Urshifu',
    'zarude':'Zarude','regieleki':'Regieleki','regidrago':'Regidrago',
    'coronospa':'Calyrex','calyrex':'Calyrex',

    // --- Generation 9 (Paldea #906-1025) ---
    'felori':'Sprigatito','sprigatito':'Sprigatito','feloren':'Floragato','floragato':'Floragato',
    'maskagato':'Meowscarada','meowscarada':'Meowscarada',
    'krokel':'Fuecoco','fuecoco':'Fuecoco','lokroko':'Crocalor','crocalor':'Crocalor',
    'skelokrok':'Skeledirge','skeledirge':'Skeledirge',
    'kwaks':'Quaxly','quaxly':'Quaxly','fuentente':'Quaxwell','quaxwell':'Quaxwell',
    'bailonda':'Quaquaval','quaquaval':'Quaquaval',
    'ferkuli':'Lechonk','lechonk':'Lechonk',
    'pawmi':'Pawmi','pawmo':'Pawmo','pawmot':'Pawmot',
    'tandemaus':'Tandemaus','maushold':'Maushold',
    'hefel':'Fidough','fidough':'Fidough','backel':'Dachsbun','dachsbun':'Dachsbun',
    'olini':'Smoliv','smoliv':'Smoliv','olivinio':'Dolliv','dolliv':'Dolliv',
    'olithena':'Arboliva','arboliva':'Arboliva',
    'knarbon':'Nacli','nacli':'Nacli','salite':'Naclstack','naclstack':'Naclstack',
    'salitura':'Garganacl','garganacl':'Garganacl',
    'klibbe':'Charcadet','charcadet':'Charcadet',
    'crimanzo':'Armarouge','armarouge':'Armarouge','azugladis':'Ceruledge','ceruledge':'Ceruledge',
    'wampitz':'Bellibolt','bellibolt':'Bellibolt',
    'tintelf':'Tinkatink','tinkatink':'Tinkatink','tintano':'Tinkatuff','tinkatuff':'Tinkatuff',
    'bossinos':'Tinkaton','tinkaton':'Tinkaton',
    'wiglett':'Wiglett','schligda':'Wugtrio','wugtrio':'Wugtrio',
    'epitaff':'Finizen','finizen':'Finizen','delfinator':'Palafin','palafin':'Palafin',
    'dummimisel':'Cyclizar','cyclizar':'Cyclizar',
    'gruff':'Greavard','greavard':'Greavard','friedhull':'Houndstone','houndstone':'Houndstone',
    'kolosswal':'Cetitan','cetitan':'Cetitan',
    'heerashai':'Dondozo','dondozo':'Dondozo','tatsugiri':'Tatsugiri',
    'annihilape':'Annihilape','clodsire':'Clodsire',
    'farigiraf':'Farigiraf','dudunsparce':'Dudunsparce',
    'kingambit':'Kingambit',
    'koraidon':'Koraidon','miraidon':'Miraidon',
    'ogerpon':'Ogerpon','terapagos':'Terapagos','pecharunt':'Pecharunt',
    'zorua':'Zorua','zoroark':'Zoroark',
    'flamigo':'Flamigo','veluza':'Veluza',
    'revavroom':'Revavroom','glimmora':'Glimmora',
    'grafaiai':'Grafaiai','brambleghast':'Brambleghast',
    'great tusk':'Great Tusk','iron treads':'Iron Treads','iron bundle':'Iron Bundle',
    'iron hands':'Iron Hands','iron jugulis':'Iron Jugulis','iron moth':'Iron Moth',
    'iron thorns':'Iron Thorns','iron valiant':'Iron Valiant',
    'walking wake':'Walking Wake','iron leaves':'Iron Leaves',
    'roaring moon':'Roaring Moon','flutter mane':'Flutter Mane',
    'sandy shocks':'Sandy Shocks','slither wing':'Slither Wing',
    'brute bonnet':'Brute Bonnet','scream tail':'Scream Tail',
};

// Build set of all English names for fast lookup
const englishNames = new Set(Object.values(pokemonNames));

// ===== Japanese Pokémon Names → English (top 50 for OCR) =====
const japaneseToEnglish = {
    'フシギダネ':'Bulbasaur','フシギソウ':'Ivysaur','フシギバナ':'Venusaur',
    'ヒトカゲ':'Charmander','リザード':'Charmeleon','リザードン':'Charizard',
    'ゼニガメ':'Squirtle','カメール':'Wartortle','カメックス':'Blastoise',
    'ピカチュウ':'Pikachu','ライチュウ':'Raichu','ミュウツー':'Mewtwo','ミュウ':'Mew',
    'イーブイ':'Eevee','ゲンガー':'Gengar','カイリュー':'Dragonite','カビゴン':'Snorlax',
    'ギャラドス':'Gyarados','ラプラス':'Lapras','プリン':'Jigglypuff',
    'ルギア':'Lugia','ホウオウ':'Ho-Oh','セレビィ':'Celebi',
    'レックウザ':'Rayquaza','カイオーガ':'Kyogre','グラードン':'Groudon',
    'ルカリオ':'Lucario','ガブリアス':'Garchomp','ディアルガ':'Dialga',
    'パルキア':'Palkia','ギラティナ':'Giratina','ダークライ':'Darkrai','アルセウス':'Arceus',
    'レシラム':'Reshiram','ゼクロム':'Zekrom','キュレム':'Kyurem',
    'ゲッコウガ':'Greninja','サーナイト':'Gardevoir',
    'ゼルネアス':'Xerneas','イベルタル':'Yveltal',
    'ソルガレオ':'Solgaleo','ルナアーラ':'Lunala','ネクロズマ':'Necrozma',
    'ミミッキュ':'Mimikyu',
    'ザシアン':'Zacian','ザマゼンタ':'Zamazenta',
    'コライドン':'Koraidon','ミライドン':'Miraidon',
    'メタグロス':'Metagross','ボーマンダ':'Salamence','バンギラス':'Tyranitar',
};

// ===== Korean Pokémon Names → English (common ones) =====
const koreanToEnglish = {
    '피카츄':'Pikachu','리자몽':'Charizard','뮤츠':'Mewtwo','뮤':'Mew',
    '이브이':'Eevee','팬텀':'Gengar','망나뇽':'Dragonite','루기아':'Lugia',
    '가이오가':'Kyogre','레쿠쟈':'Rayquaza','루카리오':'Lucario',
    '한카리아스':'Garchomp','개굴닌자':'Greninja','따라큐':'Mimikyu',
    '코라이돈':'Koraidon','미라이돈':'Miraidon',
};

// ===== TCG API — Multi-Strategy Search with Name Translation =====
async function searchTCGApi(query) {
    query = query.trim();
    if (!query) return [];

    // Translate DE/JP/KR → EN for API search
    const lowerQuery = query.toLowerCase();
    const translatedName = pokemonNames[lowerQuery];
    const searchName = translatedName || query;

    // Strategy 1: Set number (e.g., "sv1-25")
    const setNumberMatch = query.match(/^([a-z0-9]+)-(\d+)$/i);
    if (setNumberMatch) {
        const results = await fetchTCG(`q=number:"${setNumberMatch[2]}" set.id:"${setNumberMatch[1]}"&pageSize=10`);
        if (results.length > 0) return results;
    }

    // Strategy 2: Exact name
    const safeName = searchName.replace(/["""*()]/g, '').replace(/\s+/g, ' ').trim();
    if (safeName.length < 2) return [];

    let results = await fetchTCG(`q=name:"${safeName}"&pageSize=15&orderBy=-set.releaseDate`);
    if (results.length > 0) return results;

    // Strategy 3: Wildcard
    results = await fetchTCG(`q=name:"${safeName}*"&pageSize=15&orderBy=-set.releaseDate`);
    if (results.length > 0) return results;

    // Strategy 4: Individual words
    const words = safeName.split(' ').filter(w => w.length >= 3);
    for (const word of words) {
        results = await fetchTCG(`q=name:"${word}*"&pageSize=15&orderBy=-set.releaseDate`);
        if (results.length > 0) return results;
    }

    // Strategy 5: Prefix
    if (safeName.length >= 3) {
        const prefix = safeName.substring(0, Math.min(safeName.length, 6));
        results = await fetchTCG(`q=name:"${prefix}*"&pageSize=15&orderBy=-set.releaseDate`);
        if (results.length > 0) return results;
    }

    return [];
}

async function fetchTCG(queryString) {
    try {
        const res = await fetch(`${API_BASE}?${queryString}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
    } catch {
        return [];
    }
}

function getMarketPrice(apiCard) {
    const cm = apiCard.cardmarket?.prices;
    if (cm) {
        if (cm.averageSellPrice) return cm.averageSellPrice;
        if (cm.trendPrice) return cm.trendPrice;
    }
    const tcg = apiCard.tcgplayer?.prices;
    if (tcg) {
        for (const variant of ['holofoil','normal','reverseHolofoil','1stEditionHolofoil','1stEditionNormal']) {
            if (tcg[variant]?.market) return tcg[variant].market;
            if (tcg[variant]?.mid) return tcg[variant].mid;
        }
    }
    return 0;
}

// ===== ADVANCED IMAGE PREPROCESSING FOR OCR =====

// Load image from any source into an HTMLImageElement
function loadImage(source) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        if (typeof source === 'string') {
            img.src = source;
        } else if (source instanceof Blob || source instanceof File) {
            img.src = URL.createObjectURL(source);
        } else {
            reject(new Error('Unknown image source'));
        }
    });
}

// Crop to the top portion of the card where the name is
function cropNameRegion(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Name is in the top ~20% of a Pokémon card
    // Take a wider strip (top 22%) and full width for safety
    const cropH = Math.round(img.height * 0.22);
    canvas.width = img.width;
    canvas.height = cropH;
    ctx.drawImage(img, 0, 0, img.width, cropH, 0, 0, img.width, cropH);
    return canvas;
}

// Crop to the bottom portion where set number / card number is
function cropBottomRegion(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const cropH = Math.round(img.height * 0.12);
    const startY = img.height - cropH;
    canvas.width = img.width;
    canvas.height = cropH;
    ctx.drawImage(img, 0, startY, img.width, cropH, 0, 0, img.width, cropH);
    return canvas;
}

// Create multiple preprocessing variants for OCR
function createPreprocessVariants(canvas) {
    const variants = [];
    const w = canvas.width;
    const h = canvas.height;

    // --- Variant 1: High contrast black text on white ---
    const c1 = document.createElement('canvas');
    c1.width = w * 2; c1.height = h * 2; // Upscale 2x for better OCR
    const ctx1 = c1.getContext('2d');
    ctx1.drawImage(canvas, 0, 0, w * 2, h * 2);
    const d1 = ctx1.getImageData(0, 0, c1.width, c1.height);
    for (let i = 0; i < d1.data.length; i += 4) {
        const gray = 0.299 * d1.data[i] + 0.587 * d1.data[i+1] + 0.114 * d1.data[i+2];
        // Otsu-like threshold: dark text on light background
        const v = gray < 140 ? 0 : 255;
        d1.data[i] = v; d1.data[i+1] = v; d1.data[i+2] = v;
    }
    ctx1.putImageData(d1, 0, 0);
    variants.push(c1);

    // --- Variant 2: Inverted (white text on dark = light text cards) ---
    const c2 = document.createElement('canvas');
    c2.width = w * 2; c2.height = h * 2;
    const ctx2 = c2.getContext('2d');
    ctx2.drawImage(canvas, 0, 0, w * 2, h * 2);
    const d2 = ctx2.getImageData(0, 0, c2.width, c2.height);
    for (let i = 0; i < d2.data.length; i += 4) {
        const gray = 0.299 * d2.data[i] + 0.587 * d2.data[i+1] + 0.114 * d2.data[i+2];
        // Inverted: light text becomes dark on white
        const v = gray > 160 ? 0 : 255;
        d2.data[i] = v; d2.data[i+1] = v; d2.data[i+2] = v;
    }
    ctx2.putImageData(d2, 0, 0);
    variants.push(c2);

    // --- Variant 3: Adaptive contrast with sharpening ---
    const c3 = document.createElement('canvas');
    c3.width = w * 2; c3.height = h * 2;
    const ctx3 = c3.getContext('2d');
    ctx3.drawImage(canvas, 0, 0, w * 2, h * 2);
    const d3 = ctx3.getImageData(0, 0, c3.width, c3.height);
    for (let i = 0; i < d3.data.length; i += 4) {
        const gray = 0.299 * d3.data[i] + 0.587 * d3.data[i+1] + 0.114 * d3.data[i+2];
        // Strong contrast boost
        const factor = 2.5;
        const v = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
        d3.data[i] = v; d3.data[i+1] = v; d3.data[i+2] = v;
    }
    ctx3.putImageData(d3, 0, 0);
    variants.push(c3);

    return variants;
}

// Convert canvas to blob URL
function canvasToBlob(canvas) {
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve(blob ? URL.createObjectURL(blob) : null);
        }, 'image/png');
    });
}

// ===== FUZZY MATCHING — tolerates OCR typos =====
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    // Use single-row optimization
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        let curr = [i];
        for (let j = 1; j <= n; j++) {
            const cost = a[i-1] === b[j-1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j-1] + 1, prev[j-1] + cost);
        }
        prev = curr;
    }
    return prev[n];
}

// Find best fuzzy match from known names
function fuzzyMatchName(ocrWord) {
    if (!ocrWord || ocrWord.length < 3) return null;
    const lower = ocrWord.toLowerCase();

    // Exact match first
    if (pokemonNames[lower]) return pokemonNames[lower];
    for (const en of englishNames) {
        if (en.toLowerCase() === lower) return en;
    }

    // Fuzzy match: allow up to ~25% character errors
    let bestMatch = null;
    let bestDist = Infinity;
    const maxDist = Math.max(1, Math.floor(lower.length * 0.3));

    // Check DE/EN name keys
    for (const [key, enName] of Object.entries(pokemonNames)) {
        if (Math.abs(key.length - lower.length) > maxDist) continue;
        const dist = levenshtein(lower, key);
        if (dist < bestDist && dist <= maxDist) {
            bestDist = dist;
            bestMatch = enName;
        }
    }

    // Check English names directly
    for (const en of englishNames) {
        const enLow = en.toLowerCase();
        if (Math.abs(enLow.length - lower.length) > maxDist) continue;
        const dist = levenshtein(lower, enLow);
        if (dist < bestDist && dist <= maxDist) {
            bestDist = dist;
            bestMatch = en;
        }
    }

    return bestMatch;
}

// ===== ADVANCED OCR — Multi-region, multi-variant, fuzzy =====
async function performOCR(imageSource) {
    dom.ocrStatus.style.display = 'flex';
    dom.ocrStatusText.textContent = 'Bild wird vorbereitet…';

    try {
        const img = await loadImage(imageSource);
        console.log('Image loaded:', img.width, 'x', img.height);

        // Create cropped regions
        const nameCanvas = cropNameRegion(img);
        const bottomCanvas = cropBottomRegion(img);

        // Create preprocessing variants for each region
        dom.ocrStatusText.textContent = 'Bildvarianten werden erstellt…';
        const nameVariants = createPreprocessVariants(nameCanvas);
        const bottomVariants = createPreprocessVariants(bottomCanvas);

        // Convert to blob URLs
        const nameBlobUrls = await Promise.all(nameVariants.map(canvasToBlob));
        const bottomBlobUrls = await Promise.all(bottomVariants.map(canvasToBlob));

        // Also create a full-image fallback (scaled and enhanced)
        const fullCanvas = document.createElement('canvas');
        const fW = Math.min(img.width, 1200);
        const fH = Math.round(img.height * (fW / img.width));
        fullCanvas.width = fW; fullCanvas.height = fH;
        const fCtx = fullCanvas.getContext('2d');
        fCtx.drawImage(img, 0, 0, fW, fH);
        const fullBlob = await canvasToBlob(fullCanvas);

        // --- Phase 1: OCR the name region variants (English only — faster) ---
        dom.ocrStatusText.textContent = 'Name wird erkannt (Versuch 1/3)…';
        let allOcrTexts = [];
        let bestResult = null;

        for (let i = 0; i < nameBlobUrls.length; i++) {
            if (!nameBlobUrls[i]) continue;
            dom.ocrStatusText.textContent = `Name wird erkannt (Variante ${i+1}/${nameBlobUrls.length})…`;
            try {
                const r = await Tesseract.recognize(nameBlobUrls[i], 'eng', {
                    logger: info => {
                        if (info.status === 'recognizing text') {
                            const pct = Math.round((info.progress || 0) * 100);
                            dom.ocrStatusText.textContent = `Variante ${i+1}: ${pct}%`;
                        }
                    }
                });
                const text = (r.data.text || '').trim();
                console.log(`OCR name variant ${i+1}:`, text);
                if (text) allOcrTexts.push(text);

                // Try to extract a name from this variant
                const info = extractCardInfo(text);
                if (info.cardName && !bestResult?.cardName) {
                    bestResult = info;
                }
                // If we found a set number, that's even better
                if (info.setNumber && (!bestResult?.setNumber)) {
                    bestResult = { ...bestResult, ...info, setNumber: info.setNumber };
                }
            } catch (e) { console.warn('OCR variant failed:', e); }
        }

        // --- Phase 2: OCR the bottom region for set number ---
        dom.ocrStatusText.textContent = 'Set-Nummer wird erkannt…';
        for (let i = 0; i < bottomBlobUrls.length; i++) {
            if (!bottomBlobUrls[i]) continue;
            try {
                const r = await Tesseract.recognize(bottomBlobUrls[i], 'eng');
                const text = (r.data.text || '').trim();
                console.log(`OCR bottom variant ${i+1}:`, text);
                if (text) {
                    const setInfo = extractSetNumber(text);
                    if (setInfo && (!bestResult?.setNumber)) {
                        bestResult = bestResult || {};
                        bestResult.setNumber = setInfo;
                        console.log('Found set number from bottom:', setInfo);
                    }
                }
            } catch (e) { /* ignore */ }
        }

        // --- Phase 3: If no name found yet, try Japanese/Korean OCR on name region ---
        if (!bestResult?.cardName) {
            dom.ocrStatusText.textContent = 'Japanisch/Koreanisch wird geprüft…';
            try {
                const jpBlob = nameBlobUrls[2] || nameBlobUrls[0]; // use contrast variant
                if (jpBlob) {
                    const r = await Tesseract.recognize(jpBlob, 'jpn+kor', {
                        logger: info => {
                            if (info.status === 'recognizing text') {
                                const pct = Math.round((info.progress || 0) * 100);
                                dom.ocrStatusText.textContent = `JP/KR: ${pct}%`;
                            }
                        }
                    });
                    const text = (r.data.text || '').trim();
                    console.log('OCR JP/KR:', text);
                    if (text) {
                        allOcrTexts.push(text);
                        const jpInfo = extractCardInfoJPKR(text);
                        if (jpInfo) {
                            bestResult = bestResult || {};
                            bestResult.cardName = jpInfo;
                        }
                    }
                }
            } catch (e) { console.warn('JP/KR OCR failed:', e); }
        }

        // --- Phase 4: Full image fallback if nothing found ---
        if (!bestResult?.cardName && !bestResult?.setNumber) {
            dom.ocrStatusText.textContent = 'Ganzes Bild wird geprüft…';
            try {
                const r = await Tesseract.recognize(fullBlob, 'eng', {
                    logger: info => {
                        if (info.status === 'recognizing text') {
                            const pct = Math.round((info.progress || 0) * 100);
                            dom.ocrStatusText.textContent = `Vollbild: ${pct}%`;
                        }
                    }
                });
                const text = (r.data.text || '').trim();
                console.log('OCR full image:', text);
                if (text) {
                    allOcrTexts.push(text);
                    const fullInfo = extractCardInfo(text);
                    if (fullInfo.cardName || fullInfo.setNumber) {
                        bestResult = { ...(bestResult || {}), ...fullInfo };
                    }
                }
            } catch (e) { /* ignore */ }
        }

        // --- Phase 5: Fuzzy match on all collected OCR text ---
        if (!bestResult?.cardName && allOcrTexts.length > 0) {
            dom.ocrStatusText.textContent = 'Fuzzy-Matching…';
            const combined = allOcrTexts.join(' ');
            const words = combined.split(/[\s,.\-:;!?()[\]{}<>]+/).filter(w => w.length >= 3);
            for (const word of words) {
                const match = fuzzyMatchName(word);
                if (match) {
                    bestResult = bestResult || {};
                    bestResult.cardName = match;
                    console.log(`Fuzzy matched "${word}" → "${match}"`);
                    break;
                }
            }
            // Also try pairs of consecutive words
            if (!bestResult?.cardName) {
                for (let i = 0; i < words.length - 1; i++) {
                    const pair = words[i] + ' ' + words[i+1];
                    const match = fuzzyMatchName(pair);
                    if (match) {
                        bestResult = bestResult || {};
                        bestResult.cardName = match;
                        console.log(`Fuzzy matched pair "${pair}" → "${match}"`);
                        break;
                    }
                }
            }
        }

        // Cleanup blob URLs
        [...nameBlobUrls, ...bottomBlobUrls, fullBlob].forEach(url => {
            if (url) try { URL.revokeObjectURL(url); } catch {}
        });

        dom.ocrStatus.style.display = 'none';

        if (bestResult) {
            bestResult.rawText = allOcrTexts.join('\n---\n');
        }

        return bestResult || { cardName: null, setNumber: null, rawText: allOcrTexts.join('\n') };

    } catch (err) {
        console.error('OCR error:', err);
        dom.ocrStatus.style.display = 'none';
        return null;
    }
}

// Extract just the set number from text
function extractSetNumber(text) {
    // Pattern: SV1-25, swsh12-145, xy7-98, etc.
    const setIdMatch = text.match(/([A-Za-z]{2,6}\d{0,2})\s*[-–]\s*(\d{1,4})/);
    if (setIdMatch) return `${setIdMatch[1]}-${setIdMatch[2]}`;

    // Pattern: 025/165
    const slashMatch = text.match(/(\d{1,4})\s*[\/]\s*(\d{1,4})/);
    if (slashMatch) return `${slashMatch[1]}/${slashMatch[2]}`;

    return null;
}

// Check Japanese/Korean text for known names
function extractCardInfoJPKR(text) {
    for (const [jpName, enName] of Object.entries(japaneseToEnglish)) {
        if (text.includes(jpName)) return enName;
    }
    for (const [krName, enName] of Object.entries(koreanToEnglish)) {
        if (text.includes(krName)) return enName;
    }
    return null;
}

function extractCardInfo(ocrText) {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
    const allText = ocrText.replace(/\n/g, ' ');
    let setNumber = extractSetNumber(allText);

    // ===== Card Name Detection =====
    let cardName = null;
    const textLower = allText.toLowerCase();

    // 1. Check Japanese names
    for (const [jpName, enName] of Object.entries(japaneseToEnglish)) {
        if (allText.includes(jpName)) { cardName = enName; break; }
    }

    // 2. Check Korean names
    if (!cardName) {
        for (const [krName, enName] of Object.entries(koreanToEnglish)) {
            if (allText.includes(krName)) { cardName = enName; break; }
        }
    }

    // 3. Exact match all DE/EN Pokémon names (longer names first)
    if (!cardName) {
        const sortedNames = Object.keys(pokemonNames).sort((a, b) => b.length - a.length);
        for (const name of sortedNames) {
            if (name.length >= 3 && textLower.includes(name)) {
                cardName = pokemonNames[name]; break;
            }
        }
    }

    // 4. Exact match English names directly
    if (!cardName) {
        const sortedEnglish = [...englishNames].sort((a, b) => b.length - a.length);
        for (const name of sortedEnglish) {
            if (name.length >= 3 && textLower.includes(name.toLowerCase())) {
                cardName = name; break;
            }
        }
    }

    // 5. Fuzzy match each word
    if (!cardName) {
        const words = allText.split(/[\s,.\-:;!?()[\]{}<>]+/).filter(w => w.length >= 3);
        for (const word of words) {
            const match = fuzzyMatchName(word);
            if (match) { cardName = match; break; }
        }
    }

    // 6. Fallback: line-by-line extraction (first plausible line)
    if (!cardName) {
        const noise = /^(basic|stage\s*[12]?|trainer|energy|item|supporter|stadium|hp\s*\d|ex\b|gx\b|vstar|vmax|v\b|rule\s*box|ability|attack|weakness|resistance|retreat|illustrator|\d+)/i;
        for (const line of lines) {
            let cleaned = line.replace(/[^a-zA-ZäöüÄÖÜéèêàáâ\s''\-]/g, ' ').replace(/\s+/g, ' ').trim();
            if (cleaned.length < 3 || noise.test(cleaned)) continue;
            const fuzzy = fuzzyMatchName(cleaned);
            if (fuzzy) { cardName = fuzzy; break; }
            // Try individual words from the line
            const words = cleaned.split(' ').filter(w => w.length >= 3);
            for (const w of words) {
                const m = fuzzyMatchName(w);
                if (m) { cardName = m; break; }
            }
            if (cardName) break;
        }
    }

    return { cardName, setNumber, rawText: ocrText };
}

// ===== Modal Management =====
function openAddModal() {
    selectedCard = null;
    showStep('upload');
    resetUpload();
    dom.modalAdd.style.display = 'flex';
    requestAnimationFrame(() => dom.modalAdd.classList.add('visible'));
    document.body.style.overflow = 'hidden';
}

function closeAddModal() {
    dom.modalAdd.classList.remove('visible');
    setTimeout(() => { dom.modalAdd.style.display = 'none'; document.body.style.overflow = ''; }, 200);
}

function showStep(step) {
    dom.stepUpload.style.display = step === 'upload' ? '' : 'none';
    dom.stepSelect.style.display = step === 'select' ? '' : 'none';
    dom.stepConfirm.style.display = step === 'confirm' ? '' : 'none';
}

function resetUpload() {
    dom.fileInput.value = '';
    dom.uploadPreview.style.display = 'none';
    dom.uploadPlaceholder.style.display = '';
    dom.ocrStatus.style.display = 'none';
    dom.manualSearchInput.value = '';
    dom.searchResults.innerHTML = '';
    dom.searchEmpty.style.display = 'none';
    dom.searchLoading.style.display = 'none';
    dom.buyPrice.value = '';
    if (dom.manualMarketPrice) dom.manualMarketPrice.value = '';
    if (dom.marketPriceHint) dom.marketPriceHint.style.display = 'none';
}

// ===== Search and display results =====
async function doSearch(query) {
    showStep('select');
    dom.searchResults.innerHTML = '';
    dom.searchEmpty.style.display = 'none';
    dom.searchLoading.style.display = 'flex';

    const results = await searchTCGApi(query);
    dom.searchLoading.style.display = 'none';

    if (results.length === 0) { dom.searchEmpty.style.display = ''; return; }

    results.forEach((card, i) => {
        const price = getMarketPrice(card);
        const el = document.createElement('div');
        el.className = 'search-result-item';
        el.style.animationDelay = `${i * 0.04}s`;
        el.innerHTML = `
            <img src="${card.images?.small || ''}" alt="${card.name}" loading="lazy">
            <div class="search-result-info">
                <strong>${card.name}</strong>
                <span>${card.set?.name || ''} · #${card.number || ''} · ${card.rarity || ''}</span>
            </div>
            <span class="search-result-price">${price > 0 ? formatEuro(price) : '—'}</span>
        `;
        el.addEventListener('click', () => selectSearchResult(card));
        dom.searchResults.appendChild(el);
    });
}

function selectSearchResult(apiCard) {
    selectedCard = apiCard;
    const price = getMarketPrice(apiCard);

    dom.confirmImage.src = apiCard.images?.large || apiCard.images?.small || '';
    dom.confirmName.textContent = apiCard.name;
    dom.confirmSet.textContent = apiCard.set?.name || '—';
    dom.confirmRarity.textContent = apiCard.rarity || '—';
    dom.confirmNumber.textContent = apiCard.number || '—';
    dom.confirmMarketPrice.textContent = price > 0 ? formatEuro(price) : '—';
    dom.buyPrice.value = '';

    if (dom.manualMarketPrice) {
        dom.manualMarketPrice.value = '';
        if (dom.marketPriceHint) {
            dom.marketPriceHint.style.display = price <= 0 ? '' : 'none';
        }
    }

    showStep('confirm');
}

// ===== Add Card to Portfolio =====
function addCardToPortfolio() {
    if (!selectedCard) return;

    const buyPrice = parseFloat(dom.buyPrice.value) || 0;
    let marketPrice = getMarketPrice(selectedCard);
    let manualMarketPrice = false;

    if (dom.manualMarketPrice && dom.manualMarketPrice.value) {
        const mp = parseFloat(dom.manualMarketPrice.value);
        if (mp > 0) { marketPrice = mp; manualMarketPrice = true; }
    }

    const entry = {
        id: crypto.randomUUID(),
        tcgId: selectedCard.id,
        name: selectedCard.name,
        set: selectedCard.set?.name || '',
        setId: selectedCard.set?.id || '',
        number: selectedCard.number || '',
        rarity: selectedCard.rarity || '',
        imageUrl: selectedCard.images?.large || selectedCard.images?.small || '',
        marketPrice, buyPrice, manualMarketPrice,
        addedAt: Date.now(),
    };

    portfolio.push(entry);
    savePortfolio();
    updateDashboard();
    renderCards();
    closeAddModal();
    showToast(`✓ ${entry.name} hinzugefügt`);
}

// ===== Edit Modal =====
function openEditModal(cardId) {
    const card = portfolio.find(c => c.id === cardId);
    if (!card) return;
    editingCardId = cardId;
    dom.editImage.src = card.imageUrl;
    dom.editName.textContent = card.name;
    dom.editSet.textContent = `${card.set} · #${card.number}`;
    dom.editBuyPrice.value = card.buyPrice || '';
    if (dom.editMarketPrice) dom.editMarketPrice.value = card.marketPrice || '';

    dom.modalEdit.style.display = 'flex';
    requestAnimationFrame(() => dom.modalEdit.classList.add('visible'));
    document.body.style.overflow = 'hidden';
}

function closeEditModal() {
    dom.modalEdit.classList.remove('visible');
    setTimeout(() => { dom.modalEdit.style.display = 'none'; document.body.style.overflow = ''; }, 200);
    editingCardId = null;
}

function saveEditCard() {
    const card = portfolio.find(c => c.id === editingCardId);
    if (!card) return;
    card.buyPrice = parseFloat(dom.editBuyPrice.value) || 0;
    if (dom.editMarketPrice) {
        const mp = parseFloat(dom.editMarketPrice.value);
        if (mp > 0) { card.marketPrice = mp; card.manualMarketPrice = true; }
    }
    savePortfolio();
    updateDashboard();
    renderCards();
    closeEditModal();
    showToast('✓ Karte aktualisiert');
}

function deleteCard() {
    if (!confirm('Karte wirklich löschen?')) return;
    portfolio = portfolio.filter(c => c.id !== editingCardId);
    savePortfolio();
    updateDashboard();
    renderCards();
    closeEditModal();
    showToast('Karte gelöscht');
}

// ===== Refresh Prices =====
async function refreshAllPrices() {
    if (portfolio.length === 0) { showToast('Keine Karten zum Aktualisieren.'); return; }

    dom.refreshOverlay.style.display = 'flex';
    dom.refreshProgress.style.width = '0%';
    dom.refreshStatus.textContent = `0 / ${portfolio.length}`;
    let updated = 0;

    for (let i = 0; i < portfolio.length; i++) {
        const card = portfolio[i];
        if (card.manualMarketPrice) {
            const progress = ((i+1) / portfolio.length) * 100;
            dom.refreshProgress.style.width = `${progress}%`;
            dom.refreshStatus.textContent = `${i+1} / ${portfolio.length}`;
            continue;
        }
        try {
            const res = await fetch(`${API_BASE}/${card.tcgId}`);
            if (res.ok) {
                const data = await res.json();
                const newPrice = getMarketPrice(data.data);
                if (newPrice > 0) { card.marketPrice = newPrice; updated++; }
            }
        } catch (err) { console.warn(`Preis-Update fehlgeschlagen für ${card.name}:`, err); }
        const progress = ((i+1) / portfolio.length) * 100;
        dom.refreshProgress.style.width = `${progress}%`;
        dom.refreshStatus.textContent = `${i+1} / ${portfolio.length}`;
        if (i < portfolio.length - 1) await new Promise(r => setTimeout(r, 200));
    }

    savePortfolio(); updateDashboard(); renderCards();
    dom.refreshOverlay.style.display = 'none';
    showToast(`✓ ${updated} Preis${updated !== 1 ? 'e' : ''} aktualisiert`);
}

// ===== Toast =====
let toastTimeout;
function showToast(message) {
    clearTimeout(toastTimeout);
    dom.toast.textContent = message;
    dom.toast.style.display = '';
    dom.toast.classList.add('visible');
    toastTimeout = setTimeout(() => {
        dom.toast.classList.remove('visible');
        setTimeout(() => { dom.toast.style.display = 'none'; }, 300);
    }, 3000);
}

// ===== File Upload Handler =====
async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) { showToast('Bitte ein Bild hochladen.'); return; }

    const url = URL.createObjectURL(file);
    dom.uploadPreview.src = url;
    dom.uploadPreview.style.display = '';
    dom.uploadPlaceholder.style.display = 'none';

    const result = await performOCR(file);

    if (result) {
        console.log('OCR result:', result);
        let queries = [];
        if (result.setNumber) queries.push(result.setNumber);
        if (result.cardName) queries.push(result.cardName);

        let found = false;
        for (const query of queries) {
            dom.manualSearchInput.value = query;
            dom.ocrStatusText.textContent = `Suche nach "${query}"…`;
            dom.ocrStatus.style.display = 'flex';
            const results = await searchTCGApi(query);
            if (results.length > 0) {
                dom.ocrStatus.style.display = 'none';
                showStep('select');
                dom.searchResults.innerHTML = '';
                dom.searchLoading.style.display = 'none';
                results.forEach((card, i) => {
                    const price = getMarketPrice(card);
                    const el = document.createElement('div');
                    el.className = 'search-result-item';
                    el.style.animationDelay = `${i * 0.04}s`;
                    el.innerHTML = `
                        <img src="${card.images?.small || ''}" alt="${card.name}" loading="lazy">
                        <div class="search-result-info">
                            <strong>${card.name}</strong>
                            <span>${card.set?.name || ''} · #${card.number || ''} · ${card.rarity || ''}</span>
                        </div>
                        <span class="search-result-price">${price > 0 ? formatEuro(price) : '—'}</span>
                    `;
                    el.addEventListener('click', () => selectSearchResult(card));
                    dom.searchResults.appendChild(el);
                });
                found = true;
                break;
            }
        }
        dom.ocrStatus.style.display = 'none';
        if (!found) {
            const bestGuess = result.cardName || result.setNumber || '';
            dom.manualSearchInput.value = bestGuess;
            showToast('Keine Treffer — bitte den Suchbegriff korrigieren und erneut suchen.');
        }
    } else {
        showToast('Text konnte nicht erkannt werden. Bitte manuell suchen.');
    }
}

// ===== Event Listeners =====
function initEvents() {
    dom.btnAddCard.addEventListener('click', openAddModal);
    dom.modalAddClose.addEventListener('click', closeAddModal);
    dom.modalAdd.querySelector('.modal-overlay').addEventListener('click', closeAddModal);
    dom.modalEditClose.addEventListener('click', closeEditModal);
    dom.modalEdit.querySelector('.modal-overlay').addEventListener('click', closeEditModal);
    dom.uploadArea.addEventListener('click', () => dom.fileInput.click());
    dom.uploadArea.addEventListener('dragover', e => { e.preventDefault(); dom.uploadArea.classList.add('dragover'); });
    dom.uploadArea.addEventListener('dragleave', () => { dom.uploadArea.classList.remove('dragover'); });
    dom.uploadArea.addEventListener('drop', e => {
        e.preventDefault(); dom.uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files[0]);
    });
    dom.fileInput.addEventListener('change', () => { if (dom.fileInput.files.length > 0) handleFileUpload(dom.fileInput.files[0]); });
    dom.btnManualSearch.addEventListener('click', () => { const q = dom.manualSearchInput.value.trim(); if (q) doSearch(q); });
    dom.manualSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { const q = dom.manualSearchInput.value.trim(); if (q) doSearch(q); } });

    const searchInput2 = $('#manual-search-input-step2');
    const searchBtn2 = $('#btn-manual-search-step2');
    if (searchBtn2) searchBtn2.addEventListener('click', () => { const q = searchInput2.value.trim(); if (q) doSearch(q); });
    if (searchInput2) searchInput2.addEventListener('keydown', e => { if (e.key === 'Enter') { const q = searchInput2.value.trim(); if (q) doSearch(q); } });

    dom.btnBackUpload.addEventListener('click', () => showStep('upload'));
    dom.btnBackSelect.addEventListener('click', () => showStep('select'));
    dom.btnConfirmAdd.addEventListener('click', addCardToPortfolio);
    dom.btnEditSave.addEventListener('click', saveEditCard);
    dom.btnEditDelete.addEventListener('click', deleteCard);
    dom.btnRefreshPrices.addEventListener('click', refreshAllPrices);
    dom.searchInput.addEventListener('input', renderCards);
    dom.sortSelect.addEventListener('change', renderCards);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (dom.modalAdd.style.display !== 'none') closeAddModal();
            if (dom.modalEdit.style.display !== 'none') closeEditModal();
        }
    });
}

// ===== Init =====
function init() { initEvents(); updateDashboard(); renderCards(); }
init();
