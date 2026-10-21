const fs = require('fs'); 
let js = fs.readFileSync('public/company-dashboard.js', 'utf8'); 
js = js.replace(/<div style="color:#7e22ce; font-weight:700;">/g, '<div style="color:#7e22ce; font-weight:700; display:flex; justify-content:space-between; align-items:center;">'); 
js = js.replace(/(Invoice: .*?<\/div>)/g, function(m) { return m.replace('</div>', ' <button class="c-action-btn invoice" style="margin-left:10px; background:#0284c7; padding:4px 8px; font-size:12px; color:white;" onclick="openTaxInvoiceModal(\'${req._id}\')">View Bill</button></div>'); }); 
fs.writeFileSync('public/company-dashboard.js', js);