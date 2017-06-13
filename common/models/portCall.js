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
        var voyagesPairList = [];
        var len = portCallsList.length;
        for (var i = 0; i < len; i++) {
            for (var j = i + 1; j < len; j++) {
                var voy = new VoyagesPair(portCallsList[i], portCallsList[j]);
                voyagesPairList.push(voy);
            }
        }
        return voyagesPairList;
    };


    function gatherAllVoys(routesMap) {
        var allVoys = [];
        var routeids = Object.keys(routesMap);
        //console.log(routeids);
        routeids.forEach(function(rid) {
            var pcalls = routesMap[rid];
            var voys = getPosblVoyByPortcalls(pcalls);
            //console.log(voys);
            allVoys = allVoys.concat(voys)
        });
        //console.log(allVoys);
        allVoys.sort(function(v1, v2) {
            return new Date(v1.startPort.eta) > new Date(v2.startPort.eta) ? 1 : -1;
            //return v1.startPort.port > v2.startPort.port ? 1 : -1;
            //return v1.startPort.vessel > v2.startPort.vessel ? 1 : -1;
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

    function appendTranshipments2Voys(allVoys) {
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
                console.log("portcall find ...");
                console.log(calls);
                //console.log(cb);
                var routeMap = groupRoutesByRouteId(calls);
                var allVoys = gatherAllVoys(routeMap);
                var voysDepMap = groupVoyByDepPort(allVoys);
                console.log("routeMap ...");
                console.log(routeMap);
                console.log(allVoys);
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

};