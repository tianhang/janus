'use strict';

module.exports = function(PortCall) {

    //voyage model
    function VoyagesPair(startPort, endPort, isTranshipment) {
        this.startPort = startPort;
        this.endPort = endPort;
        this.isTranshipment = isTranshipment || false;
    }

    function groupRoutesByRouteId(portCalls) {
        //<routeid,array>
        let routesGroupMap = new Map();
        portCalls.forEach((elem) => {
            if (!routesGroupMap.get(elem.routeId)) {
                routesGroupMap.set(elem.routeId, []);
            }
            routesGroupMap.get(elem.routeId).push(elem);

        });
        return routesGroupMap;
    };

    function getPosblVoyByPortcalls(portCallsList) {
        let voyagesPairList = [];
        const len = portCallsList.length;
        for (let i = 0; i < len; i++) {
            for (let j = i + 1; j < len; j++) {
                let voy = new VoyagesPair(portCallsList[i], portCallsList[j]);
                voyagesPairList.push(voy);
            }
        }
        return voyagesPairList;
    };

    function gatherAllVoys(routesMap) {
        let allVoys = [];
        for (let rid of routesMap.keys()) {
            let pcalls = routesMap.get(rid);
            let voys = getPosblVoyByPortcalls(pcalls);
            allVoys = allVoys.concat(voys)
        }
        return allVoys;
    };

    function groupVoyByDepPort(allVoys) {
        let voyMap = new Map();
        allVoys.forEach((voy) => {
            if (!voyMap.get(voy.startPort.port)) {
                voyMap.set(voy.startPort.port, []);
            }
            voyMap.get(voy.startPort.port).push(voy);
        });
        return voyMap;
    };

    function filterTranTargetByDate(depDate, tranTargetList) {
        let result = [];
        if (!depDate) return result;
        tranTargetList.forEach((target) => {
            if (new Date(target.startPort.eta) > new Date(depDate)) {
                result.push(target);
            }
        });
        return result;
    }

    function appendTranshipments2Voys(allVoys, voyPortMap) {
        let transList = [];
        allVoys.forEach(function(voy) {
            let port = voy.startPort.port;
            let depDate = voy.startPort.eta;
            let tranTargetList = voyPortMap.get(port);
            let filteredTranTargetList = filterTranTargetByDate(depDate, tranTargetList);
            filteredTranTargetList.forEach((target) => {
                if (voy.startPort.routeId != target.startPort.routeId) {
                    transList.push(new VoyagesPair(voy.startPort, target.startPort, true));
                }
            });
        });
        return allVoys.concat(transList);
    }

    PortCall.getVoyages = function(etd, eta, trshipEnabled, cb) {
        // For more information on how to query data in loopback please see
        // https://docs.strongloop.com/display/public/LB/Querying+data
        const query = {
            where: {
                and: [{ // port call etd >= etd param, or can be null
                        or: [{ etd: { gte: etd } }, { etd: null }]
                    },
                    { // port call eta <= eta param, or can be null
                        or: [{ eta: { lte: eta } }, { eta: null }]
                    }
                ]
            }
        };

        PortCall.find(query)
            .then(calls => {
                // TODO: convert port calls to voyages/routes
                console.log("portcall find ...");
                let routeMap = groupRoutesByRouteId(calls);
                let allVoys = gatherAllVoys(routeMap);
                if (trshipEnabled) {
                    let voysDepMap = groupVoyByDepPort(allVoys);
                    allVoys = appendTranshipments2Voys(allVoys, voysDepMap);
                }
                console.log("routeMap ...");
                return cb(null, allVoys);
            })
            .catch(err => {
                console.log(err);

                return cb(err);
            });
    };

    PortCall.getRoutes = function(etd, eta, cb) {
        // For more information on how to query data in loopback please see
        // https://docs.strongloop.com/display/public/LB/Querying+data
        const query = {
            where: {
                and: [{ // port call etd >= etd param, or can be null
                        or: [{ etd: { gte: etd } }, { etd: null }]
                    },
                    { // port call eta <= eta param, or can be null
                        or: [{ eta: { lte: eta } }, { eta: null }]
                    }
                ]
            }
        };

        PortCall.find(query)
            .then(calls => {
                // TODO: convert port calls to voyages/routes
                return cb(null, calls);
            })
            .catch(err => {
                console.log(err);

                return cb(err);
            });
    };

    PortCall.remoteMethod('getRoutes', {
        accepts: [
            { arg: 'etd', 'type': 'date' },
            { arg: 'eta', 'type': 'date' }
        ],
        returns: [
            { arg: 'routes', type: 'array', root: true }
        ]
    });

    PortCall.remoteMethod('getVoyages', {
        accepts: [
            { arg: 'etd', 'type': 'date' },
            { arg: 'eta', 'type': 'date' },
            { arg: 'trshipEnabled', 'type': 'Boolean' }
        ],
        returns: [
            { arg: 'voys', type: 'array', root: true }
        ]
    });

};