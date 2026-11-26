const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function capturar(){
 const eventos={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8'),{
 URL,Set,self:{registration:{scope:'https://example.org/finanzas/'},addEventListener:(n,f)=>eventos[n]=f}
 });
 return eventos.fetch;
}
test('worker: documentos y copias no se sustituyen por index',()=>{
 const handle=capturar();
 for(const ruta of ['docs/guia-instalacion-y-pruebas.pdf','copia.json','README.md']){
 let interceptada=false;handle({request:{method:'GET',mode:'navigate',url:'https://example.org/finanzas/'+ruta},respondWith:()=>interceptada=true});
 assert.equal(interceptada,false,ruta);
 }
});
test('worker: sitios externos y métodos de escritura se mantienen fuera de caché',()=>{
 const handle=capturar();
 for(const request of [{method:'POST',mode:'cors',url:'https://example.org/finanzas/index.html'},{method:'GET',mode:'navigate',url:'https://otro.example/index.html'}]){
 let interceptada=false;handle({request,respondWith:()=>interceptada=true});assert.equal(interceptada,false);
 }
});
