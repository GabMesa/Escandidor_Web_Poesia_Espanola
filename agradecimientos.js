import {attributionGroups,creditLink,creditEscape} from './attribution-resources.js';

document.querySelector('#credits-resources').innerHTML=attributionGroups.map(group=>`<section class="credits-section"><h2>${creditEscape(group.title)}</h2>${group.items.map(([name,description,source,license,notice,extra])=>`<article class="credits-resource"><h3>${creditLink(source,name)}</h3><p>${creditEscape(description)}</p><p class="credit-license">${creditLink(notice,license)}${extra?'<br>'+creditLink(extra,'Licencia de fflate'):''}</p></article>`).join('')}</section>`).join('');
async function loadFontNotices(){
  const list=document.querySelector('#credits-font-list');
  try{
    const response=await fetch('/licenses/fonts/catalog.json');
    if(!response.ok)throw Error('Font notices unavailable');
    const fonts=await response.json();
    list.innerHTML=fonts.map(font=>`<div>${creditLink('/'+font.path,font.name)}<span>${creditEscape(font.license)} · ${creditLink(font.source,'Fuente y autoría')}</span></div>`).join('');
  }catch{list.innerHTML=creditLink('/THIRD-PARTY-LICENSES.md','Consultar las fuentes y licencias completas');}
}
loadFontNotices();
const donorList = document.getElementById('donorList');
const donorStatus = document.getElementById('donorStatus');

async function loadDonors() {
  try {
    const response = await fetch('/api/supporters/acknowledgements');
    if (!response.ok) throw new Error();
    const payload = await response.json();

    if (!payload.donors.length) {
      donorStatus.textContent = 'Aún no hay donaciones. El primer nombre puede ser el tuyo.';
      return;
    }

    donorList.replaceChildren(...payload.donors.map((donor) => {
      const item = document.createElement('li');
      item.textContent = donor.name;
      item.classList.toggle('is-anonymous', donor.anonymous);
      return item;
    }));
    donorList.hidden = false;
    donorStatus.hidden = true;
  } catch {
    donorStatus.textContent = 'No se pudo cargar la lista de agradecimientos.';
  }
}

loadDonors();
