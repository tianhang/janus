angular
    .module('app')
    .controller('VoyagesCtrl', VoyagesCtrl);

function VoyagesCtrl($log, PortCall) {

    let ctrl = this;
    console.log(PortCall);
    ctrl.itemsByPage = 11;
    ctrl.voyages = [];
    ctrl.trshipEnabled = false;

    ctrl.dateOptions = {
        initDate: new Date(2016, 00, 01),
        formatYear: 'yy',
        startingDay: 1
    };

    ctrl.getRoutes = (etd, eta) => {
        const params = { etd, eta };

        PortCall.getRoutes(params).$promise
            .then(voyages => {
                console.log("=====");
                console.log(voyages);
                ctrl.voyages = voyages;
            })
            .catch(err => {
                $log.error(err);
            });
    };

    ctrl.getVoyages = (etd, eta, trshipEnabled) => {
        const params = { etd, eta, trshipEnabled };
        console.log(params);
        PortCall.getVoyages(params).$promise
            .then(voyages => {
                console.log("=====");
                console.log(voyages);
                ctrl.voyages = voyages;
            })
            .catch(err => {
                $log.error(err);
            });
    };

}

VoyagesCtrl.$inject = ['$log', 'PortCall'];