angular
    .module('app', [
        'lbServices',
        'ui.router',
        'ui.bootstrap',
        'uiSwitch',
        'smart-table'
    ])
    .config(['$stateProvider', '$urlRouterProvider',
        function($stateProvider, $urlRouterProvider) {
            $stateProvider
                .state('voyages', {
                    url: '',
                    templateUrl: 'views/voyages.html',
                    controller: 'VoyagesCtrl as ctrl'
                });

            $urlRouterProvider.otherwise('voyages');
        }
    ]);