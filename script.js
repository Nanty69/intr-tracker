const featuredTokens = [
  { name: 'INC', symbol: 'INC', chain: 'PulseChain', api: 'https://gopulse.com/api/token/INC' },
  { name: 'PLSX', symbol: 'PLSX', chain: 'PulseChain', api: 'https://gopulse.com/api/token/PLSX' },
  { name: 'PLS', symbol: 'PLS', chain: 'PulseChain', api: 'https://gopulse.com/api/token/PLS' }
];
const priceCache = {};
const cacheTTL = 60000;
const LOCAL_KEY = 'studio_featured_tokens';

function loadTokens() {
  const saved = localStorage.getItem(LOCAL_KEY);
  return saved ? JSON.parse(saved) : featuredTokens;
}

function saveTokens(tokens) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tokens));
}

function fetchTokenPrice(token) {
  const now = Date.now();
  const cached = priceCache[token.symbol];
  if (cached && now - cached.timestamp < cacheTTL) return Promise.resolve(cached.price);
  return fetch(token.api).then(res => res.json()).then(data => {
    const price = data[token.symbol?.toLowerCase()]?.usd || data?.priceUSD || Object.values(data)[0]?.usd || 0;
    priceCache[token.symbol] = { price, timestamp: now };
    return price;
  }).catch(() => 0);
}

function renderTokens() {
  const grid = document.getElementById('tokenGrid');
  const tokens = loadTokens();
  grid.innerHTML = '';
  tokens.forEach(async token => {
    const price = await fetchTokenPrice(token);
    const card = document.createElement('div');
    card.className = 'token-card';
    card.innerHTML = `<h3>${token.symbol}</h3><p>$${price.toFixed(4)}</p><p>${token.chain}</p>`;
    grid.appendChild(card);
  });
}

function addToken() {
  const symbol = document.getElementById('token-input').value.trim();
  const api = document.getElementById('api-input').value.trim();
  const chain = document.getElementById('chain-input').value.trim();
  if (!symbol || !api || !chain) return alert('Fill all fields!');
  const tokens = loadTokens();
  tokens.push({ name: symbol, symbol, chain, api });
  saveTokens(tokens);
  renderTokens();
}

function refreshTokens() {
  renderTokens();
}

function connectWallet() {
  alert('Wallet connection placeholder'); // Replace with MetaMask logic if needed
}

renderTokens();
let userWallet = null;

async function connectWallet() {
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userWallet = accounts[0];
      alert('Connected: ' + userWallet);
      document.querySelector('.wallet-address').textContent = userWallet;
    } catch (err) {
      alert('MetaMask connection rejected');
    }
  } else {
    alert('MetaMask not detected. Please install it.');
  }
}

const chains = {
  pulsechain: {
    name: 'PulseChain',
    chainId: '0x89A', // 22026 in hex
    rpc: 'https://rpc.pulsechain.com'
  },
  ethereum: {
    name: 'Ethereum',
    chainId: '0x1',
    rpc: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY'
  },
  avalanche: {
    name: 'Avalanche',
    chainId: '0xA86A',
    rpc: 'https://api.avax.network/ext/bc/C/rpc'
  },
  polygon: {
    name: 'Polygon',
    chainId: '0x89',
    rpc: 'https://polygon-rpc.com'
  },
  binance: {
    name: 'Binance',
    chainId: '0x38',
    rpc: 'https://bsc-dataseed.binance.org'
  }
};

let activeChain = 'pulsechain';

async function switchChain(chainKey) {
  if (!chains[chainKey]) return alert('Unsupported chain');
  activeChain = chainKey;
  const { chainId, rpc } = chains[chainKey];
  if (window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId, rpcUrls: [rpc], chainName: chains[chainKey].name }]
          });
        } catch (addError) {
          console.error('Add chain failed', addError);
        }
      }
    }
  } else {
    alert('MetaMask not detected, using fallback RPC');
  }
  refreshTokens();
}

document.addEventListener('DOMContentLoaded', () => {
  const chainSelector = document.createElement('select');
  chainSelector.innerHTML = Object.keys(chains).map(key => 
    `<option value="${key}">${chains[key].name}</option>`
  ).join('');
  chainSelector.onchange = e => switchChain(e.target.value);
  document.body.prepend(chainSelector);
});

async function getProvider() {
  if (window.ethereum && window.ethereum.isConnected()) {
    return new ethers.providers.Web3Provider(window.ethereum);
  } else {
    const rpc = chains[activeChain]?.rpc;
    return new ethers.providers.JsonRpcProvider(rpc);
  }
}

async function getTokenBalance(token, walletAddress) {
  if (!walletAddress) return 0;
  const abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ];
  const provider = await getProvider();
  const contract = new ethers.Contract(token.address, abi, provider);
  const [balance, decimals] = await Promise.all([
    contract.balanceOf(walletAddress),
    contract.decimals()
  ]);
  return parseFloat(ethers.utils.formatUnits(balance, decimals));
}

async function fetchTokenPrice(token) {
  const now = Date.now();
  const cached = priceCache[token.symbol];
  if (cached && now - cached.timestamp < cacheTTL) return cached.price;

  const provider = await getProvider();
  let price = 0;
  try {
    if (token.address && window.userWallet) {
      price = await getTokenBalance(token, window.userWallet);
    } else {
      const res = await fetch(token.api);
      const data = await res.json();
      price = data[token.symbol?.toLowerCase()]?.usd || data?.priceUSD || Object.values(data)[0]?.usd || 0;
    }
    priceCache[token.symbol] = { price, timestamp: now };
    return price;
  } catch (e) {
    return 0;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.querySelector('button[onclick="connectWallet()"]');
  if (connectBtn) connectBtn.addEventListener('click', async () => {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    window.userWallet = accounts[0];
    renderTokens();
  });
});

async function renderTokens() {
  const grid = document.getElementById('tokenGrid');
  const tokens = loadTokens();
  grid.innerHTML = '';
  for (const token of tokens) {
    const price = await fetchTokenPrice(token);
    const balance = token.address && window.userWallet
      ? await getTokenBalance(token, window.userWallet)
      : 0;
    const logo = token.logo || 'https://via.placeholder.com/32';
    const name = token.name || token.symbol;
    const usdValue = (price * balance).toFixed(2);
    const card = document.createElement('div');
    card.className = 'token-card';
    card.innerHTML = `
      <img src="${logo}" alt="${token.symbol} Logo" width="32" height="32"/>
      <h3>${token.symbol} - ${name}</h3>
      <p>${balance.toFixed(4)} ${token.symbol} ($${usdValue})</p>
      <p>${token.chain}</p>
    `;
    grid.appendChild(card);
  }
}

const MORALIS_API_KEY = 'YOUR_MORALIS_API_KEY_HERE'; // Replace with actual key

async function fetchTokenInfoMoralis(chainKey, walletAddress) {
  const chainMap = {
    pulsechain: '0x89a', // Moralis may not support PulseChain directly
    ethereum: 'eth',
    avalanche: 'avalanche',
    polygon: 'polygon',
    binance: 'bsc'
  };
  const chain = chainMap[chainKey] || 'eth';
  const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=${chain}`;
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    });
    const data = await res.json();
    return data.map(t => ({
      name: t.name,
      symbol: t.symbol,
      address: t.token_address,
      logo: t.logo || 'https://via.placeholder.com/32',
      balance: parseFloat(t.balance) / Math.pow(10, t.decimals || 18),
      usd: parseFloat(t.usdPrice || 0),
      chain: chains[chainKey].name
    }));
  } catch (err) {
    console.warn('Moralis fetch failed', err);
    return null;
  }
}

async function renderTokens() {
  const grid = document.getElementById('tokenGrid');
  grid.innerHTML = 'Loading...';
  const wallet = window.userWallet;
  if (!wallet) return grid.innerHTML = 'Connect wallet first';

  let tokenData = await fetchTokenInfoMoralis(activeChain, wallet);
  if (!tokenData || tokenData.length === 0) {
    return grid.innerHTML = 'No tokens found or error loading';
  }

  grid.innerHTML = '';
  tokenData.forEach(token => {
    const card = document.createElement('div');
    card.className = 'token-card';
    const usdValue = (token.usd * token.balance).toFixed(2);
    card.innerHTML = `
      <img src="${token.logo}" alt="${token.symbol} Logo" width="32" height="32"/>
      <h3>${token.symbol} - ${token.name}</h3>
      <p>${token.balance.toFixed(4)} ${token.symbol} ($${usdValue})</p>
      <p>${token.chain}</p>
    `;
    grid.appendChild(card);
  });
}

const tokenCache = {};
const cacheExpiry = 3 * 60 * 1000; // 3 minutes

async function fetchTokenInfoMoralis(chainKey, walletAddress) {
  const chainMap = {
    pulsechain: '0x89a', // PulseChain not officially supported by Moralis, may fail
    ethereum: 'eth',
    avalanche: 'avalanche',
    polygon: 'polygon',
    binance: 'bsc'
  };
  const chain = chainMap[chainKey] || 'eth';

  const now = Date.now();
  const cacheKey = `${walletAddress}_${chain}`;
  const cached = tokenCache[cacheKey];

  if (cached && now - cached.timestamp < cacheExpiry) {
    console.log('🧠 Using cached token data');
    return cached.data;
  }

  const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20?chain=${chain}`;
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    });
    const data = await res.json();
    const parsed = data.map(t => ({
      name: t.name,
      symbol: t.symbol,
      address: t.token_address,
      logo: t.logo || 'https://via.placeholder.com/32',
      balance: parseFloat(t.balance) / Math.pow(10, t.decimals || 18),
      usd: parseFloat(t.usdPrice || 0),
      chain: chains[chainKey].name
    }));
    tokenCache[cacheKey] = { timestamp: now, data: parsed };
    return parsed;
  } catch (err) {
    console.warn('❌ Moralis failed, falling back');
    return [];
  }
}

async function renderTokens() {
  const grid = document.getElementById('tokenGrid');
  grid.innerHTML = 'Loading...';
  const wallet = window.userWallet;
  if (!wallet) return grid.innerHTML = 'Connect wallet first';

  let tokenData = await fetchTokenInfoMoralis(activeChain, wallet);
  if (!tokenData || tokenData.length === 0) {
    return grid.innerHTML = 'No tokens found or error loading';
  }

  grid.innerHTML = '';
  tokenData.forEach(token => {
    const card = document.createElement('div');
    card.className = 'token-card';
    const usdValue = (token.usd * token.balance).toFixed(2);
    card.innerHTML = `
      <img src="${token.logo}" alt="${token.symbol} Logo" width="32" height="32"/>
      <h3>${token.symbol} - ${token.name}</h3>
      <p>${token.balance.toFixed(4)} ${token.symbol} ($${usdValue})</p>
      <p>${token.chain}</p>
    `;
    grid.appendChild(card);
  });
}

function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function renderTokens() {
  const grid = document.getElementById('tokenGrid');
  grid.innerHTML = 'Loading...';
  const wallet = window.userWallet;
  if (!wallet) return grid.innerHTML = 'Connect wallet first';

  let tokenData = await fetchTokenInfoMoralis(activeChain, wallet);
  if (!tokenData || tokenData.length === 0) {
    return grid.innerHTML = 'No tokens found or error loading';
  }

  const now = Date.now();
  grid.innerHTML = '';
  tokenData.forEach(token => {
    const card = document.createElement('div');
    card.className = 'token-card';
    const usdValue = (token.usd * token.balance).toFixed(2);
    card.innerHTML = `
      <img src="${token.logo}" alt="${token.symbol} Logo" width="32" height="32"/>
      <h3>${token.symbol} - ${token.name}</h3>
      <p>${token.balance.toFixed(4)} ${token.symbol} ($${usdValue})</p>
      <p>${token.chain}</p>
      <small style="color:#999;">Last updated: ${formatTime(now)}</small>
    `;
    grid.appendChild(card);
  });
}

function showSpinner() {
  const grid = document.getElementById('tokenGrid');
  grid.innerHTML = '<div class="spinner"></div>';
}

function hideSpinner() {
  // optional if needed later
}

async function renderTokens() {
  const grid = document.getElementById('tokenGrid');
  showSpinner();
  const wallet = window.userWallet;
  if (!wallet) return grid.innerHTML = 'Connect wallet first';

  let tokenData = await fetchTokenInfoMoralis(activeChain, wallet);
  if (!tokenData || tokenData.length === 0) {
    return grid.innerHTML = 'No tokens found or error loading';
  }

  const now = Date.now();
  grid.innerHTML = '';
  tokenData.forEach(token => {
    const card = document.createElement('div');
    card.className = 'token-card';
    const usdValue = (token.usd * token.balance).toFixed(2);
    card.innerHTML = `
      <img src="${token.logo}" alt="${token.symbol} Logo" width="32" height="32"/>
      <h3>${token.symbol} - ${token.name}</h3>
      <p>${token.balance.toFixed(4)} ${token.symbol} ($${usdValue})</p>
      <p>${token.chain}</p>
      <small style="color:#999;">Last updated: ${formatTime(now)}</small>
    `;
    grid.appendChild(card);
  });
}

function showSpinner() {
  const spinner = document.getElementById('globalSpinner');
  if (spinner) spinner.classList.remove('hidden');
}
function hideSpinner() {
  const spinner = document.getElementById('globalSpinner');
  if (spinner) spinner.classList.add('hidden');
}

async function renderTokens() {
  showSpinner();
  const grid = document.getElementById('tokenGrid');
  const wallet = window.userWallet;
  if (!wallet) {
    grid.innerHTML = 'Connect wallet first';
    hideSpinner();
    return;
  }

  let tokenData = await fetchTokenInfoMoralis(activeChain, wallet);
  hideSpinner();
  if (!tokenData || tokenData.length === 0) {
    return grid.innerHTML = 'No tokens found or error loading';
  }

  const now = Date.now();
  grid.innerHTML = '';
  tokenData.forEach(token => {
    const card = document.createElement('div');
    card.className = 'token-card';
    const usdValue = (token.usd * token.balance).toFixed(2);
    card.innerHTML = `
      <img src="${token.logo}" alt="${token.symbol} Logo" width="32" height="32"/>
      <h3>${token.symbol} - ${token.name}</h3>
      <p>${token.balance.toFixed(4)} ${token.symbol} ($${usdValue})</p>
      <p>${token.chain}</p>
      <small style="color:#999;">Last updated: ${formatTime(now)}</small>
    `;
    grid.appendChild(card);
  });
}

let countdownInterval;
let countdownValue = 10;

function startCountdown() {
  clearInterval(countdownInterval);
  countdownValue = 10;
  const countdownEl = document.getElementById('countdownTimer');
  countdownEl.textContent = `Next update in ${countdownValue}s`;

  countdownInterval = setInterval(() => {
    countdownValue--;
    countdownEl.textContent = `Next update in ${countdownValue}s`;
    if (countdownValue <= 0) {
      clearInterval(countdownInterval);
      renderTokens();
    }
  }, 1000);
}

// Trigger the first countdown on wallet connect
document.addEventListener('DOMContentLoaded', () => {
  const connectBtn = document.querySelector('button[onclick="connectWallet()"]');
  if (connectBtn) connectBtn.addEventListener('click', () => setTimeout(startCountdown, 1000));
});

function exportToCSV() {
  const grid = document.getElementById('tokenGrid');
  const cards = grid.querySelectorAll('.token-card');
  if (!cards.length) return alert('No token data to export');

  let csv = 'Symbol,Name,Balance,USD Value,Chain\n';
  cards.forEach(card => {
    const text = card.innerText.split('\n');
    const [symbolName, balanceLine, chain] = text;
    const [symbol, name] = symbolName.split(' - ');
    const [balancePart] = balanceLine.split('(');
    const balance = balancePart.trim().split(' ')[0];
    const usd = balanceLine.match(/\$([\d\.]+)/)?.[1] || '0';
    csv += `${symbol},${name},${balance},${usd},${chain}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'token_data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function manualRefresh() {
  startCountdown();
  renderTokens();
}

// Extend chain switch to restart countdown
async function switchChain(chainKey) {
  if (!chains[chainKey]) return alert('Unsupported chain');
  activeChain = chainKey;
  const { chainId, rpc } = chains[chainKey];
  if (window.ethereum) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId, rpcUrls: [rpc], chainName: chains[chainKey].name }]
          });
        } catch (addError) {
          console.error('Add chain failed', addError);
        }
      }
    }
  } else {
    alert('MetaMask not detected, using fallback RPC');
  }
  renderTokens();
  startCountdown(); // trigger refresh countdown
}

// Extend token add to restart countdown
function addToken() {
  const symbol = document.getElementById('token-input').value.trim();
  const api = document.getElementById('api-input').value.trim();
  const chain = document.getElementById('chain-input').value.trim();
  if (!symbol || !api || !chain) return alert('Fill all fields!');
  const tokens = loadTokens();
  tokens.push({ name: symbol, symbol, chain, api });
  saveTokens(tokens);
  renderTokens();
  startCountdown(); // refresh countdown
}

async function fetchTransactionsMoralis(walletAddress, chainKey) {
  const chainMap = {
    pulsechain: '0x89a',
    ethereum: 'eth',
    avalanche: 'avalanche',
    polygon: 'polygon',
    binance: 'bsc'
  };
  const chain = chainMap[chainKey] || 'eth';
  const url = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers?chain=${chain}&limit=15`;
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': MORALIS_API_KEY }
    });
    const data = await res.json();
    return data.result || [];
  } catch (err) {
    console.warn('Moralis transactions failed', err);
    return [];
  }
}

async function renderTransactions() {
  const txList = document.getElementById('transactionList');
  if (!txList || !window.userWallet) return;

  showSpinner();
  const transactions = await fetchTransactionsMoralis(window.userWallet, activeChain);
  hideSpinner();

  if (!transactions.length) {
    txList.innerHTML = '<p style="text-align:center;">No recent transactions found</p>';
    return;
  }

  txList.innerHTML = '';
  transactions.forEach(tx => {
    const dir = tx.to_address.toLowerCase() === window.userWallet.toLowerCase() ? 'IN' : 'OUT';
    const hashLink = `https://explorer.pulsechain.com/tx/${tx.transaction_hash}`;
    const timestamp = new Date(tx.block_timestamp).toLocaleString();
    const row = document.createElement('div');
    row.innerHTML = `<strong>${dir}</strong> ${tx.value / Math.pow(10, tx.token_decimal || 18)} ${tx.token_symbol}
      <br/><small>${timestamp}</small> <br/>
      <a href="${hashLink}" target="_blank" style="color:#88f;">View Tx</a><hr/>`;
    txList.appendChild(row);
  });
}

function showCompareModal() {
  const modal = document.getElementById('compareModal');
  const selectA = document.getElementById('compareTokenA');
  const selectB = document.getElementById('compareTokenB');
  const txs = document.getElementById('transactionList');
  const tokens = Array.from(txs.querySelectorAll('div'))
    .flatMap(div => Array.from(div.innerText.matchAll(/[A-Z0-9]{2,5}/g)).map(m => m[0]));

  const unique = [...new Set(tokens)];
  selectA.innerHTML = '<option value="">Select Token A</option>' + unique.map(t => `<option value="${t}">${t}</option>`).join('');
  selectB.innerHTML = '<option value="">Select Token B</option>' + unique.map(t => `<option value="${t}">${t}</option>`).join('');
  modal.classList.remove('hidden');
}

function autoCompareTokens() {
  const a = document.getElementById('compareTokenA').value;
  const b = document.getElementById('compareTokenB').value;
  const btn = document.getElementById('compareBtn');
  btn.disabled = !(a && b);
  if (a && b) compareTokens();
}

function compareTokens() {
  const a = document.getElementById('compareTokenA').value;
  const b = document.getElementById('compareTokenB').value;
  const list = document.getElementById('transactionList');
  const result = document.getElementById('compareResult');

  if (!list || !a || !b) return;

  let totalIn = 0, totalOut = 0, recent = [];
  const txs = list.querySelectorAll('div');

  txs.forEach(tx => {
    const text = tx.innerText;
    if (text.includes(a) && text.includes(b)) {
      const matchOut = text.match(new RegExp(`-?(\d+\.?\d*)\s+${a}`));
      const matchIn = text.match(new RegExp(`\+?(\d+\.?\d*)\s+${b}`));
      if (matchOut) totalOut += parseFloat(matchOut[1]);
      if (matchIn) totalIn += parseFloat(matchIn[1]);
      recent.push(text);
    }
  });

  result.innerHTML = `
    <p><strong>Total ${a} Sent:</strong> ${totalOut.toFixed(4)}</p>
    <p><strong>Total ${b} Received:</strong> ${totalIn.toFixed(4)}</p>
    <h4 style="margin-top:10px;">Last 5 Matching Trades</h4>
    ${recent.slice(0, 5).map(t => `<div style="margin-bottom:10px;">${t}</div>`).join('')}
  `;
}
