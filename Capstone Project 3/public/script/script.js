window.addEventListener('load', function () {
    const clickedButtons = document.getElementsByClassName("findPostsButton");
    for (let i = 0; i < clickedButtons.length; i++) {
        clickedButtons[i].addEventListener("click", () => {
            const myForm = document.getElementsByClassName("findPostsForm");
            if (myForm[i].style.display !== "block") {
                myForm[i].style.display = "block";
            } else {
                myForm[i].style.display = "none";
            }
        });
    }; 
});