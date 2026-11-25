//Confirmación de borrado
let borradoAbierto = false;
async function confirmarBorrado(texto="¿Eliminar este registro?") {
    if (borradoAbierto) return false;
    borradoAbierto=true;
    const dialogo=document.createElement("dialog");dialogo.className="dialogo-borrado";
    dialogo.setAttribute("aria-label","Confirmar eliminación");
    const p=document.createElement("p");p.textContent=texto;
    const no=document.createElement("button");no.type="button";no.textContent="No";no.autofocus=true;
    const si=document.createElement("button");si.type="button";si.textContent="Sí";si.className="boton-peligro";
    dialogo.append(p,no,si);document.body.append(dialogo);
    return new Promise(resolve=>{
        const cerrar=valor=>{dialogo.close();dialogo.remove();borradoAbierto=false;resolve(valor);};
        no.onclick=()=>cerrar(false);si.onclick=()=>cerrar(true);
        dialogo.oncancel=e=>{e.preventDefault();cerrar(false);};
        dialogo.showModal();no.focus();
    });
}
