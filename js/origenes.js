//Origen de apartados
function limpiarAportacionesNomina(lista) {
    if (lista === undefined) return [];
    if (!Array.isArray(lista)) return null;

    const limpias = [];
    const ids = new Set();

    for (const movimiento of lista) {
        if (
            !movimiento ||
            typeof movimiento !== "object" ||
            Array.isArray(movimiento) ||
            !["id", "nominaId", "categoriaId"].every(
                campo =>
                    typeof movimiento[campo] === "string" &&
                    movimiento[campo].trim() !== ""
            ) ||
            ids.has(movimiento.id) ||
            !Number.isSafeInteger(movimiento.montoCentavos) ||
            movimiento.montoCentavos <= 0
        ) {
            return null;
        }

        ids.add(movimiento.id);

        limpias.push({
            id: movimiento.id,
            nominaId: movimiento.nominaId,
            categoriaId: movimiento.categoriaId,
            montoCentavos: movimiento.montoCentavos
        });
    }

    return limpias;
}

function obtenerApartadosNomina(
    listaDeudas = deudas,
    listaGrupos = gruposDeudas
) {
    const movimientos = [];

    for (const deuda of listaDeudas) {
        movimientos.push(...(deuda.aportacionesNomina ?? []));
    }

    for (const grupo of listaGrupos) {
        for (const movimiento of grupo.movimientosFondo ?? []) {
            if (
                movimiento.tipo === "apartado" &&
                movimiento.origenNomina
            ) {
                movimientos.push({
                    ...movimiento.origenNomina,
                    montoCentavos: movimiento.montoCentavos
                });
            }
        }
    }

    return movimientos;
}

function validarOrigenesNomina(
    listaNominas,
    listaDeudas,
    listaGrupos
) {
    const movimientos = limpiarAportacionesNomina(
        obtenerApartadosNomina(listaDeudas, listaGrupos)
    );

    if (movimientos === null) return false;

    try {
        for (const movimiento of movimientos) {
            const nomina = listaNominas.find(
                elemento => elemento.id === movimiento.nominaId
            );

            calcularDisponibleCategoria(
                nomina,
                movimiento.categoriaId,
                movimientos
            );
        }

        return true;
    } catch {
        return false;
    }
}

function registrarApartadoConNomina(
    tipo,
    destinoId,
    textoMonto
) {
    if (!puedeModificarDeudas()) return false;

    try {
        const monto = convertirPesosACentavos(textoMonto);

        if (monto === null) {
            throw new Error("Escribe un importe positivo válido.");
        }

        const nomina = nominas.find(
            elemento => elemento.id === campoNominaOrigen.value
        );

        const categoriaId = campoCategoriaOrigen.value;

        if (!nomina || categoriaId === "") {
            throw new Error(
                "Selecciona el pago y la categoría de origen."
            );
        }

        const anteriores = obtenerApartadosNomina();

        const disponible = calcularDisponibleCategoria(
            nomina,
            categoriaId,
            anteriores
        );

        if (monto > disponible.disponibleCentavos) {
            throw new Error(
                "En esa categoría quedan " +
                formatoMoneda.format(
                    disponible.disponibleCentavos / 100
                ) +
                ". No se registró el apartado."
            );
        }

        const registro = {
            id: generarId(
                anteriores.map(movimiento => movimiento.id)
            ),
            nominaId: nomina.id,
            categoriaId: categoriaId,
            montoCentavos: monto
        };

        const nuevasDeudas = copiar(deudas);
        const nuevosGrupos = copiar(gruposDeudas);

        if (tipo === "deuda") {
            const deuda = nuevasDeudas.find(
                elemento => elemento.id === destinoId
            );

            const grupo = nuevosGrupos.find(
                elemento => elemento.id === deuda?.grupoId
            );

            if (
                !deuda ||
                deuda.liquidada ||
                grupo?.modalidad === "grupo"
            ) {
                throw new Error(
                    "Selecciona una deuda que reciba apartados individuales."
                );
            }

            if (monto > resumirDeuda(deuda).faltaCentavos) {
                throw new Error(
                    "El importe supera lo que falta reunir para esa deuda."
                );
            }

            deuda.aportacionesNomina ??= [];
            deuda.aportacionesNomina.push(registro);
        } else if (tipo === "grupo") {
            const grupo = nuevosGrupos.find(
                elemento => elemento.id === destinoId
            );

            if (!grupo || grupo.modalidad !== "grupo") {
                throw new Error(
                    "Selecciona un grupo con fondo compartido."
                );
            }

            const resumen = resumirFondoGrupo(
                grupo,
                nuevasDeudas
            );

            if (
                resumen === null ||
                monto > resumen.faltaCentavos
            ) {
                throw new Error(
                    "El importe supera lo que falta reunir para el grupo."
                );
            }

            grupo.movimientosFondo ??= [];

            grupo.movimientosFondo.push({
                tipo: "apartado",
                montoCentavos: monto,
                deudaId: null,
                origenNomina: {
                    id: registro.id,
                    nominaId: registro.nominaId,
                    categoriaId: registro.categoriaId
                }
            });
        } else {
            throw new Error(
                "El destino del apartado no es válido."
            );
        }

        const limpias = limpiarDeudas(nuevasDeudas);
        const gruposLimpios = limpiarGruposDeudas(nuevosGrupos);

        if (
            limpias === null ||
            gruposLimpios === null ||
            !validarFondosGrupos(gruposLimpios, limpias) ||
            !validarOrigenesNomina(
                nominas,
                limpias,
                gruposLimpios
            )
        ) {
            throw new Error(
                "Los datos del apartado no pasaron la comprobación."
            );
        }

        const deudasAnteriores = deudas;
        const gruposAnteriores = gruposDeudas;

        deudas = limpias;
        gruposDeudas = gruposLimpios;

        if (!guardar()) {
            deudas = deudasAnteriores;
            gruposDeudas = gruposAnteriores;

            throw new Error(
                "No se pudo guardar. El apartado no se aplicó."
            );
        }
    } catch (error) {
        informarDeudas(error.message, true);
        return false;
    }

    mostrarDeudas();
    mostrarHistorialNominas();
    invalidarProyeccionDeudas();

    informarDeudas(
        "Apartado registrado con su pago de origen.",
        false
    );

    return true;
}

//Controles de origen
const campoNominaOrigen =
    document.getElementById("nomina-origen-apartado");

const campoCategoriaOrigen =
    document.getElementById("categoria-origen-apartado");

const disponibleOrigen =
    document.getElementById("disponible-origen-apartado");

function actualizarOrigenApartados() {
    const anterior = campoNominaOrigen.value;

    campoNominaOrigen.replaceChildren(
        new Option("Selecciona un pago", "")
    );

    for (const nomina of [...nominas].reverse()) {
        campoNominaOrigen.add(
            new Option(nomina.referencia, nomina.id)
        );
    }

    campoNominaOrigen.value = nominas.some(
        nomina => nomina.id === anterior
    ) ? anterior : "";

    actualizarCategoriasOrigen();
}

function actualizarCategoriasOrigen() {
    const anterior = campoCategoriaOrigen.value;

    const nomina = nominas.find(
        elemento => elemento.id === campoNominaOrigen.value
    );

    campoCategoriaOrigen.replaceChildren(
        new Option("Selecciona una categoría", "")
    );

    for (const categoria of nomina?.reparto ?? []) {
        campoCategoriaOrigen.add(
            new Option(categoria.nombre, categoria.id)
        );
    }

    campoCategoriaOrigen.value = nomina?.reparto.some(
        categoria => categoria.id === anterior
    ) ? anterior : "";

    campoCategoriaOrigen.disabled = !nomina;

    mostrarDisponibleOrigen();
}

function mostrarDisponibleOrigen() {
    const nomina = nominas.find(
        elemento => elemento.id === campoNominaOrigen.value
    );

    const categoria = nomina?.reparto.find(
        elemento => elemento.id === campoCategoriaOrigen.value
    );

    let texto =
        "Selecciona el pago y la categoría que financiarán el próximo apartado.";

    if (nomina && categoria) {
        try {
            const resumen = calcularDisponibleCategoria(
                nomina,
                categoria.id,
                obtenerApartadosNomina()
            );

            texto =
                nomina.referencia + " · " +
                categoria.nombre +
                " · Disponible para nuevos apartados: " +
                formatoMoneda.format(
                    resumen.disponibleCentavos / 100
                );
        } catch {
            texto =
                "No se pudo calcular la disponibilidad de este origen.";
        }
    }

    disponibleOrigen.textContent = texto;

    for (
        const aviso of document.querySelectorAll(
            ".origen-apartado-actual"
        )
    ) {
        aviso.textContent = texto;
    }
}

function describirOrigenNomina(origen) {
    const nomina = nominas.find(
        elemento => elemento.id === origen.nominaId
    );

    const categoria = nomina?.reparto.find(
        elemento => elemento.id === origen.categoriaId
    );

    return (
        (nomina?.referencia ?? "Pago registrado") +
        " / " +
        (categoria?.nombre ?? "Categoría registrada")
    );
}

campoNominaOrigen.addEventListener("change", function () {
    campoCategoriaOrigen.value = "";
    actualizarCategoriasOrigen();
});

campoCategoriaOrigen.addEventListener(
    "change",
    mostrarDisponibleOrigen
);