'use strict';

module.exports = function(PortCall) {

    //voyage model
    function VoyagesPair(startPort, endPort, isTranshipment) {
        this.startPort = startPort;
        this.endPort = endPort;
        this.isTranshipment = isTranshipment || false;
    }

    function groupRoutesByRouteId(portCalls) {
        //<routeid,[]>
        var routesGroupMap = {};
        portCalls.forEach(function(elem) {
            if (!routesGroupMap[elem.routeId]) {
                routesGroupMap[elem.routeId] = [];
            }
            routesGroupMap[elem.routeId].push(elem);

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
        let routeids = Object.keys(routesMap);
        //console.log(routeids);
        routeids.forEach((rid) => {
            var pcalls = routesMap[rid];
            var voys = getPosblVoyByPortcalls(pcalls);
            //console.log(voys);
            allVoys = allVoys.concat(voys)
        });
        return allVoys;
    };

    function groupVoyByDepPort(allVoys) {
        var voyMap = {};
        allVoys.forEach(function(voy) {
            if (!voyMap[voy.startPort.port]) {
                voyMap[voy.startPort.port] = [];
            }
            voyMap[voy.startPort.port].push(voy);
        });
        return voyMap;
    };

    function filterTranTargetByDate(depDate, tranTargetList) {
        var result = [];
        if (!depDate) return result;
        tranTargetList.forEach(function(target) {
            if (new Date(target.startPort.eta) > new Date(depDate)) {
                result.push(target);
            }
        });
        return result;
    }

    function appendTranshipments2Voys(allVoys, voyPortMap) {
        var transList = [];
        allVoys.forEach(function(voy) {
            var port = voy.startPort.port;
            var depDate = voy.startPort.eta;
            var tranTargetList = voyPortMap[port];
            var filteredTranTargetList = filterTranTargetByDate(depDate, tranTargetList);
            filteredTranTargetList.forEach(function(target) {
                if (voy.startPort.routeId != target.startPort.routeId) {
                    transList.push(new VoyagesPair(voy.startPort, target.startPort, true));
                }
            });
            //transList.push(new VoyagesPair(voy,))
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
                console.log(trshipEnabled);
                //console.log(calls);
                //console.log(cb);
                var routeMap = groupRoutesByRouteId(calls);
                var allVoys = gatherAllVoys(routeMap);
                console.log(allVoys.length);
                if (trshipEnabled) {
                    var voysDepMap = groupVoyByDepPort(allVoys);
                    allVoys = appendTranshipments2Voys(allVoys, voysDepMap);
                    console.log(allVoys.length);
                }
                console.log("routeMap ...");
                //console.log(routeMap);
                //console.log(allVoys);
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