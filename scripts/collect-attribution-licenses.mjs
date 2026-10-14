import {mkdir,writeFile,readFile} from 'node:fs/promises';

// Run explicitly when updating credits; builds use the checked-in notices.
await mkdir('licenses/fonts',{recursive:true});
const fonts=['Alegreya','Atkinson Hyperlegible','Bebas Neue','Bungee','Caveat','Cinzel','Cormorant Garamond','EB Garamond','Josefin Sans','Lexend','Libre Baskerville','Lora','Merriweather','Montserrat','Nunito','Pacifico','Permanent Marker','Playfair Display','Source Sans 3','UnifrakturCook'];
async function collect(path,urls){
  for(const url of urls){
    const response=await fetch(url);
    if(!response.ok)continue;
    const content=await response.text();
    if(!/license|licence|permission/i.test(content))throw Error('Unexpected notice: '+url);
    await writeFile(path,content);
    return url;
  }
  throw Error('License not found: '+path);
}
const families=await Promise.all(fonts.map(async name=>{
  const slug=name.toLowerCase().replaceAll(' ',''),path=`licenses/fonts/${slug}.txt`;
  const source=await collect(path,[`https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`,`https://raw.githubusercontent.com/google/fonts/main/apache/${slug}/LICENSE.txt`]);
  return {name,license:source.includes('/apache/')?'Apache 2.0':'SIL OFL 1.1',path,source};
}));
await writeFile('licenses/fonts/catalog.json',JSON.stringify(families,null,2)+'\n');
await writeFile('licenses/unpdf.txt',await readFile('node_modules/unpdf/LICENSE','utf8'));
const notices=[
  ['pdfjs.txt',['https://raw.githubusercontent.com/mozilla/pdf.js/master/LICENSE']],
  ['apache-2.0.txt',['https://raw.githubusercontent.com/mozilla/pdf.js/master/LICENSE']],
  ['msgpack.txt',['https://raw.githubusercontent.com/msgpack/msgpack-javascript/v3.1.2/LICENSE','https://raw.githubusercontent.com/msgpack/msgpack-javascript/main/LICENSE']],
  ['fflate.txt',['https://raw.githubusercontent.com/101arrowz/fflate/v0.8.2/LICENSE']],
  ['jspdf.txt',['https://raw.githubusercontent.com/parallax/jsPDF/v2.5.1/LICENSE','https://raw.githubusercontent.com/parallax/jsPDF/v2.5.1/license.txt']],
  ['simple-icons.txt',['https://raw.githubusercontent.com/simple-icons/simple-icons/develop/LICENSE.md','https://raw.githubusercontent.com/simple-icons/simple-icons/master/LICENSE.md']]
];
await Promise.all(notices.map(([name,urls])=>collect('licenses/'+name,urls)));
console.log(`Collected ${families.length} font notices and component licenses.`);
