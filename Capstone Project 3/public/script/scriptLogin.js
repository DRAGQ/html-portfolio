window.addEventListener('load', function () {
        var signUpToggleButton = document.getElementById("signUpToggleButton");
        var signUpToggleDiv = document.getElementById("signUpToggleDiv");
        var registerButton = document.getElementById("registerButton");
        const errMsgDiv = document.getElementById("errMsgDiv");
        var errMsg = document.getElementById("errMsg").innerHTML;

            if (errMsg === "The passwords are not the same !") {
                registerButton.style.display = "none";
                loginRegisterToggle()
            }
            if (errMsg === "Incorrect password!") {
                registerButton.style.display = "none";
            } else {
                registerButton.style.display = "block";
            }

            if (errMsg) errMsgDiv.style.display = "block";
            else errMsgDiv.style.display = "none";
    
        registerButton.addEventListener("click", () => {
            loginRegisterToggle();
        });

        signUpToggleButton.addEventListener("click", () => {
            loginRegisterToggle();
        });


        function loginRegisterToggle() {
            const logForm = document.getElementById("logAuthBox");
            const confirm = document.getElementsByClassName("confirmPassword");
            const submitBtn = document.getElementById("submitButton");
            errMsgDiv.style.display = "none";
            for (let i = 0; i < confirm.length; i++) {
                if (confirm[i].style.display !== "block") {
                    confirm[i].style.display = "block";
                } else {
                    confirm[i].style.display = "none";
                }
            }

            if (signUpToggleButton.innerHTML === "Sign up for Blog") {
                logForm.style.height = "500px";
                submitBtn.innerHTML = "Register";
                signUpToggleButton.innerHTML = "Sign In";
                signUpToggleDiv.firstChild.textContent = "Do you have account already ?";
            } else {
                submitBtn.innerHTML = "Login";
                logForm.style.height = "450px";
                signUpToggleButton.innerHTML = "Sign up for Blog";
                signUpToggleDiv.firstChild.textContent = "Don't have an account ?";
            }
        }
    });