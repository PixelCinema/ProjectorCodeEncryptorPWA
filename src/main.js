const CONFIG = {
  allowedUsername: "admin",
  allowedPassword: "1234"
};
function isNumeric(str) {
  return /^[0-9]+$/.test(str);
}

let currentSecretKey = "";
let isAuthenticated = false;

const loginTab = document.getElementById('login');
const generatorTab = document.getElementById('generator');
const loginError = document.getElementById('loginError');
const passwordOutput = document.getElementById('passwordOutput');
const loginBtn = document.getElementById('loginBtn');
const generateBtn = document.getElementById('generateBtn');
const passwordInput = document.getElementById('password');
const togglePassword = document.querySelector('.toggle-password');
const secretKeyInput = document.getElementById('secretKey');
const usernameInput = document.getElementById('username');
const copyBtn = document.getElementById('copyBtn');
const backBtn = document.getElementById('backBtn');

// Toggle password visibility
togglePassword.addEventListener('click', () => {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  togglePassword.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
});

function getMidnightInTimeZone(input, timeZone = "Asia/Tehran") {
  const inputDate = (input instanceof Date) ? input : new Date(input);
  //const [year, month, day] = dateString.split("-").map(Number);
  // 1. Initial guess: Treat the date and time as pure UTC
  //let targetUtcTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0);
  let targetUtcTimestamp = inputDate.getTime()
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  // Helper to extract the local representation in the target time zone
  function getParts(timestamp) {
    const parts = formatter.formatToParts(new Date(timestamp));
    const obj = {};
    for (const { type, value } of parts) {
      obj[type] = parseInt(value, 10);
    }
    // formatToParts with hour12: false can return 24 for midnight
    if (obj.hour === 24) obj.hour = 0;
    return obj;
  }
  // 2. Measure what time our guess renders as in Asia/Tehran
  const p = getParts(targetUtcTimestamp);
  const guessedLocalTimestamp = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // 3. Offset adjustment
  const offset = guessedLocalTimestamp - targetUtcTimestamp;
  targetUtcTimestamp -= offset;
  console.debug(`getMidnightInTimeZone(...): offset = ${offset}`);
  // 4. Verification step (handles edge cases around DST transitions)
  const verify = getParts(targetUtcTimestamp);
  const verifyLocalTimestamp = Date.UTC(verify.year, verify.month - 1, verify.day, verify.hour, verify.minute, verify.second);
  //const secondPassOffset = verifyLocalTimestamp - Date.UTC(year, month - 1, day, 0, 0, 0);
  const secondPassOffset = verifyLocalTimestamp - inputDate.getTime();
  console.debug(`getMidnightInTimeZone(...): secondPassOffset = ${secondPassOffset}`);
  return new Date(targetUtcTimestamp - secondPassOffset);
}

async function calcSHA256(inputString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(inputString);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data)).toHex();
  return hash;
}

// TODO: check this non-async minimal version:
//function ArraybufferToBase64(data) {
//  return btoa(String.fromCharCode(...new Uint8Array(data)));
//}
// or this:
//function ArraybufferToBase64(data) {
//  let binary = '';
//  const bytes = new Uint8Array(data);
//  const len = bytes.byteLength;
//  for (let i = 0; i < len; i++) {
//    binary += String.fromCharCode(bytes[i]);
//  }
//  return btoa(binary);
//}
async function ArraybufferToBase64(data) {
  const base64url = await new Promise((r) => {
    const reader = new FileReader();
    reader.onload = () => r(reader.result);
    reader.readAsDataURL(new Blob([data]));
  });
  return base64url.split(",", 2)[1];
};
async function ArraybufferToBase32(data) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = new Uint8Array(data);
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

async function encrypt(inputString, passkeyString, withSalt) {
  const Module = await EmscrJSR_openssl();
  Module.FS.writeFile("/input.txt", inputString);
  const opensslArgs = ['enc', '-aes-256-cbc', '-in', 'input.txt', '-out', 'output.txt', withSalt ? '-salt': '-nosalt', '-pass', `pass:${passkeyString}`];
  console.debug(`running openssl with args: ${opensslArgs}\ninput.txt contains: ${inputString}`);
  const result = Module.callMain(opensslArgs);
  if (result == 0) {
      return Module.FS.readFile("/output.txt");
  } else {
      throw new Error(`error: openssl returned: ${result}`);
  }
}

// Login function
function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    loginError.textContent = "Please fill all fields";
    return;
  }
  if (username !== CONFIG.allowedUsername || password !== CONFIG.allowedPassword) {
    loginError.textContent = "Invalid username or password";
    return;
  }
  isAuthenticated = true;
  loginError.textContent = "";
  loginTab.style.display = 'none';
  generatorTab.style.display = 'block';
}

loginBtn.addEventListener('click', login);
[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
});

generateBtn.addEventListener('click', async () => {
  if (! document.getElementById('dateInput').value) {
    document.getElementById('dateInput').value = (() => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
      });
      // en-CA also produces YYYY-MM-DD
      return formatter.format(now);
    })();
  }
  if (! document.getElementById('hourInput').value.trim()) {
    document.getElementById('hourInput').value = (() => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          hour12: false,
      });
      // en-CA also produces YYYY-MM-DD
      return formatter.format(now);
    })();
  }

  const projectorCode = document.getElementById('projectorCode').value.trim();
  const date = document.getElementById('dateInput').value;
  const hour = parseInt(document.getElementById('hourInput').value.trim(), 10);
  const uuid = document.getElementById('uuid').value.trim();

  if (!projectorCode || !uuid) {
    passwordOutput.textContent = `"Projector Code" and "Server UUID" fields must be filled out.`;
    passwordOutput.style.color = "#ff6b6b";
    copyBtn.style.display = "none";
    return;
  }
  // if (!isNumeric(code)) {
  //   passwordOutput.textContent = "The code should only contain numbers.";
  //   passwordOutput.style.color = "#ff6b6b";
  //   copyBtn.style.display = "none";
  //   return;
  // }
  // if (!isNumeric(uuid)) {
  //   passwordOutput.textContent = "The certificate should only contain numbers.";
  //   passwordOutput.style.color = "#ff6b6b";
  //   copyBtn.style.display = "none";
  //   return;
  // }
  if (hour < 0 || hour > 23) {
    passwordOutput.textContent = "The hour must be between 0 and 23.";
    passwordOutput.style.color = "#ff6b6b";
    copyBtn.style.display = "none";
    return;
  }

  try {
    //if (date) {
    console.debug(`generateBtn onClick(): doing getMidnightInTimeZone("${date}T00:00:00Z").getTime() + ...`);
    const inputTime = getMidnightInTimeZone(`${date}T00:00:00Z`).getTime() + (hour * 60 * 60 * 1000);
    console.debug(`generateBtn onClick(): inputTime is ${inputTime}`);
    //} else {
    //    const now = new Date()
    //    if (hour) {
    //    const inputTime = getMidnightInTimeZone(`${date}T00:00:00Z`).getTime() + (hour * 60 * 60 * 1000);
    //    console.debug(`generateBtn onClick(): inputTime is ${inputTime}`);
    //}
    // const uuid 
    let password = await encrypt(`${projectorCode}:${inputTime}`, uuid, false);
    //password = await ArraybufferToBase64(password);
    password = await ArraybufferToBase32(password);
    password = password.substring(0, 10); // Shorten it
    password = password.toUpperCase();
    console.log(`password is ${password}`);
    passwordOutput.textContent = `HDCP Password: ${password}`;
    passwordOutput.style.color = "#327c34";
    copyBtn.style.display = "inline-block";
    copyBtn.dataset.password = password;
  } catch (error) {
    passwordOutput.textContent = "error in create password " + error.message;
    passwordOutput.style.color = "#ff6b6b";
    copyBtn.style.display = "none";
  }
});


// Copy to clipboard with feedback
copyBtn.addEventListener('click', () => {
  const password = copyBtn.dataset.password;
  if (!password) return;

  if (!navigator.clipboard) {
    alert('Clipboard API not supported or insecure context');
    return;
  }

  navigator.clipboard.writeText(password).then(() => {
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#327c34" viewBox="0 0 24 24">
      <path d="M20.285 6.709l-11.285 11.293-5.285-5.293 1.415-1.414 3.87 3.879 9.87-9.879z"/>
    </svg>`;
    setTimeout(() => {
      copyBtn.textContent = "📋";
    }, 2000);
  }).catch(err => {
    alert("Failed to copy: " + err);
  });
});

// Back button to login
backBtn.addEventListener('click', () => {
  generatorTab.style.display = 'none';
  loginTab.style.display = 'block';

  passwordOutput.textContent = "";
  copyBtn.style.display = "none";
  document.getElementById('hdcpCode').value = "";
  document.getElementById('dateInput').value = "";
  document.getElementById('hourInput').value = "";
});
