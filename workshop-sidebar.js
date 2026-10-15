// Keep resources visible beside the desktop workspace and compact on phones.
const resources = document.querySelector('.sidebar-resources');
if (resources) {
  const mobile = matchMedia('(max-width: 760px)');
  const setDefault = () => { resources.open = !mobile.matches; };
  setDefault();
  mobile.addEventListener('change', setDefault);
}
