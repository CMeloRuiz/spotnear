-- "Es cubierto" dejó de venir marcado de fábrica.
--
-- La columna tenía DEFAULT true y los tres formularios de alta arrancaban con
-- el casillero tildado, así que todo estacionamiento nacía "cubierto" sin que
-- nadie lo hubiera decidido. En la tarjeta de resultados eso se traducía en un
-- tag "Cubierto" que no era un dato del estacionamiento: era el default.
--
-- Un atributo que se le promete al cliente tiene que ser una decisión del
-- dueño. Ahora el default es false y el tag aparece solo si alguien lo marcó.
ALTER TABLE "Parking" ALTER COLUMN "cubierto" SET DEFAULT false;

-- Corrección puntual del único dato que sabemos que está mal: Parking Thames
-- 350 no es techado, y su `true` vino del default de arriba, no de una
-- decisión. Se toca esta fila y nada más: el resto de los valores guardados se
-- dejan como están, porque acá no hay forma de saber quién tildó el casillero
-- a mano. Cada dueño lo revisa en su panel.
UPDATE "Parking" SET "cubierto" = false WHERE "slug" = 'parking-thames-350';
