import client from "../src/index.js";


async function main() {

    for(let i = 1; i < 82; i++){
        const elements = await client.element.create({
            data: {
                imageUrl: "/Tiles/HighTiles/HighTiles" + i + ".png",
                width: 1,
                height: 1,
                static: false
            }
        })
    }

    console.log("Done!");   

}

main();