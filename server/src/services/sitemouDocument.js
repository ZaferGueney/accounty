const mongoose = require('mongoose');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validate(body, invoice) {
  if (body.documentBrand !== 'sitemou') return;
  const party = invoice ? body.counterpart : body.customer;
  const country = invoice ? party?.country : party?.address?.country;
  if (country !== 'GR' || (invoice && !/^\d{9}$/.test(party?.vatNumber || ''))) throw Error('SiteMou currently supports Greek billing details only.');
  if (invoice && body.invoiceType !== '2.1') throw Error('A Greek service invoice is required.');
  if (!party?.address?.street || !party?.address?.city || !party?.address?.postalCode || (invoice && !party.name)) throw Error('Complete billing name and address are required.');
  const external = invoice ? body.reference : body.payment?.stripeSessionId;
  if (!/^sitemou:in_[A-Za-z0-9]+$/.test(external || '')) throw Error('A SiteMou Stripe invoice reference is required.');
  if (!body.payment?.paid || !Number.isSafeInteger(body.payment.totalCents) || body.payment.totalCents < 1) throw Error('A paid amount in cents is required.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.some(i => !Number.isSafeInteger(i.grossCents) || i.grossCents < 0 || i.quantity !== 1 || i.vatCategory !== '1')) throw Error('Invalid SiteMou invoice lines.');
  if (body.items.reduce((n,i) => n+i.grossCents,0) !== body.payment.totalCents) throw Error('Invoice total differs from the payment.');
}
function money(item) {
  const net = Math.round(item.grossCents / 1.24);
  return {unitPrice:net/100,netValue:net/100,vatAmount:(item.grossCents-net)/100};
}
async function number(userId, kind) {
  const series = kind === 'invoice' ? 'SMI' : 'SMR';
  const row = await mongoose.connection.db.collection('sitemou_document_counters').findOneAndUpdate({_id:String(userId)+':'+series},{$inc:{value:1}},{upsert:true,returnDocument:'after'});
  return series + String(row.value).padStart(6,'0');
}
function html(d, language='en', preview=false) {
  const el=language==='el'; const t=el ? ['Τιμολόγιο','Απόδειξη','Ημερομηνία','Προς','Περιγραφή','Καθαρή αξία','ΦΠΑ','Σύνολο','Εξοφλήθηκε','Δείγμα — δεν είναι φορολογικό παραστατικό','Εκδότης'] : ['Invoice','Receipt','Date','Billed to','Description','Net amount','VAT','Total','Paid','Preview — not a tax document','Legal issuer'];
  const euro=n=>new Intl.NumberFormat(el?'el-GR':'en-IE',{style:'currency',currency:'EUR'}).format(n||0);
  const issuer=d.issuer||{},buyer=d.counterpart||{},address=x=>[x?.street,x?.number,x?.postalCode,x?.city].filter(Boolean).join(' ');
  const legal=[issuer.name,issuer.legalForm==='ee'&&!/E\.E\.|Ε\.Ε\./.test(issuer.name||'')?'E.E.':''].filter(Boolean).join(' ');
  const qr=/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(d.aadeInfo?.qrUrl||'')?`<img width="84" height="84" src="${d.aadeInfo.qrUrl}" alt="Verification QR">`:'';
  return `<!doctype html><html lang="${el?'el':'en'}"><meta charset="utf-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#183d31;margin:0}header{background:#183d31;color:#f8f5ed;padding:30px;border-radius:16px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:38px;font-weight:800;letter-spacing:-2px}.dot{color:#d7f46b}.tag{font-size:10px;letter-spacing:2px;margin-top:8px}h1{font-size:22px;margin:0 0 9px}.meta{display:flex;justify-content:space-between;margin:30px 0;line-height:1.8}.muted{color:#64746c;font-size:11px}.buyer{max-width:60%}table{width:100%;border-collapse:collapse;margin:24px 0}th{background:#f2f4ec;font-size:10px;text-align:left;padding:12px}td{padding:16px 12px;border-bottom:1px solid #e0e6dd}th:not(:first-child),td:not(:first-child){text-align:right;white-space:nowrap}.totals{margin-left:auto;width:260px}.totals p{display:flex;justify-content:space-between}.total{background:#d7f46b;padding:16px;border-radius:10px;font-size:20px;font-weight:bold}footer{margin-top:42px;border-top:1px solid #ccd8cd;padding-top:18px;font-size:10px;line-height:1.8;display:flex;justify-content:space-between}.preview{color:#9b3b27;font-weight:bold;margin:20px 0}tr{break-inside:avoid}</style><header><div><div class="logo">sitemou<span class="dot">.</span></div><div class="tag">YOUR WEBSITE. READY IN MINUTES.</div></div><div><h1>${d.invoiceType==='11.2'?t[1]:t[0]}</h1>${esc(d.invoiceNumber||'PREVIEW')}</div></header>${preview||d.aadeStatus!=='transmitted'?`<p class="preview">${t[9]}</p>`:''}<section class="meta"><div class="buyer"><div class="muted">${t[3]}</div><strong>${esc(buyer.name)}</strong><br>${esc(address(buyer.address))}<br>${esc(buyer.email||'')}${buyer.vatNumber?`<br>ΑΦΜ / VAT ${esc(buyer.vatNumber)}`:''}</div><div><span class="muted">${t[2]}</span><br>${esc(new Date(d.issueDate).toLocaleDateString(el?'el-GR':'en-GB'))}<br><strong>${d.status==='paid'?t[8]:''}</strong></div></section><table><thead><tr><th>${t[4]}</th><th>${t[5]}</th><th>${t[6]}</th><th>${t[7]}</th></tr></thead><tbody>${(d.invoiceDetails||[]).map(i=>`<tr><td>${esc(i.description)}<br><span class="muted">${esc(i.itemDescription||'')}</span></td><td>${euro(i.netValue)}</td><td>${euro(i.vatAmount)}</td><td>${euro((i.netValue||0)+(i.vatAmount||0))}</td></tr>`).join('')}</tbody></table><div class="totals"><p>${t[5]}<span>${euro(d.totals?.totalNetValue)}</span></p><p>${t[6]} 24%<span>${euro(d.totals?.totalVatAmount)}</span></p><p class="total">${t[7]}<span>${euro(d.totals?.totalAmount)}</span></p></div><footer><div><strong>SiteMou · sitemou.app · info@sitemou.app</strong><br>${t[10]}: <strong>${esc(legal)}</strong><br>${esc(address(issuer.address))} · Greece<br>ΑΦΜ / VAT ${esc(issuer.taxInfo?.afm||issuer.vatNumber)} · ΓΕΜΗ ${esc(issuer.taxInfo?.gemi)}<br>ΔΟΥ ${esc(issuer.taxInfo?.doy?.name)}${d.aadeInfo?.mark?`<br>myDATA MARK ${esc(d.aadeInfo.mark)}`:''}</div>${qr}</footer></html>`;
}
module.exports={validate,money,number,html};
