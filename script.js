
const shopItems = [
    { name: "Dumbbells 10kg", price: "$40",img:"imgs/2dumbells.jpg" },
    { name: "Yoga Mat", price: "$25",img:"imgs/yoga mat.jpg" },
    { name: "Protein Shaker", price: "$10",img:"imgs/protein shaker.jpg" },
    { name: "Resistance Bands", price: "$18",img:"imgs/2resistance band.jpg" }
];


const trainers = [
    { name: "Mark Haddad", specialty: "Strength Coach" },
    { name: "Sara Mansour", specialty: "Yoga & Stretching" },
    { name: "Omar Kamel", specialty: "Body Transformation" }
];


const shopContainer = document.getElementById("shopItems");
if (shopContainer) {
    shopItems.forEach(item => {
        shopContainer.innerHTML += `
            <div class="card">
            <img src="${item.img}" alt="${item.name}"/>
                <h3>${item.name}</h3>
                <p>${item.price}</p>
                <button class="btn">Buy</button>
            </div>
        `;
    });
}


const trainerContainer = document.getElementById("trainerList");
if (trainerContainer) {
    trainers.forEach(tr => {
        trainerContainer.innerHTML += `
            <div class="card">
                <h3>${tr.name}</h3>
                <p>${tr.specialty}</p>
            </div>
        `;
    });
}
