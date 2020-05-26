/**
* The `Debug` module implements logging that is shown not every frame but only once per several to make messages more readable.
*
* @class Debug
*/

var Debug = {};

(function() {

    //Types of forces
    Debug.frequency = 3*60*60; //Once per 3 minutes (60 FSP * 60 seconds per minute)
    Debug.counter = 2;

    Debug.init = function(engine) {
        Matter.Events.on(engine, "afterUpdate", (event) => {
            Debug.counter -= 1;
            if (Debug.counter < 0) {
                Debug.counter =  Debug.frequency;
            }
       });
    };

    Debug.log = function() {
        if (console && Debug.counter==0) {
            console.log.apply(console, ['debug:'].concat(Array.prototype.slice.call(arguments)));
        }
    };

})();
