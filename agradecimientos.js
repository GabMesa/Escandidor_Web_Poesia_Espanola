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