'use strict';

module.exports = function(PortCall) {
    /**
     * voyage class
     */
    class VoyagesPair {
        constructor(startPort, endPort, isTranshipment = false) {
            this.startPort = startPort;
            this.endPort = endPort;
            this.isTranshipment = isTranshipment;
        }
    }
    /**
     * group by routeId
     * @param  Array portCalls
     * @return Map <routeId,portCalls Array>  
     */
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

    function checkValidity(countMap, depPort, arrPort) {
        if (depPort.port === arrPort.port) return false;
        let arrPortList = [];
        var result = true;
        if (countMap.has(depPort.id)) {
            arrPortList = countMap.get(depPort.id);
        } else {
            return true;
        }
        for (let item of arrPortList) {
            if (item.port === arrPort.port) {
                return false;
            }
        }
        return result;
    }
    /**
     * take portcalls array and return all possible VoyagesPair array
     * @param  Array portCallsList
     * @return Array VoyagesPair array
     */
    function getPosblVoyByPortcalls(portCallsList) {
        let voyagesPairList = [];
        let countMap = new Map();
        const len = portCallsList.length;
        for (let i = 0; i < len; i++) {
            let depPort = portCallsList[i];
            for (let j = i + 1; j < len; j++) {
                let arrPort = portCallsList[j];
                if (!countMap.has(depPort.id)) {
                    countMap.set(depPort.id, []);
                }
                //filter invalid voyage pairs , duplicated voyage pairs
                // each dep port's arrival ports should be different at the same date
                if (checkValidity(countMap, depPort, arrPort)) {
                    let voy = new VoyagesPair(depPort, arrPort);
                    voyagesPairList.push(voy);
                    countMap.get(depPort.id).push(arrPort);
                }
            }
        }
        return voyagesPairList;
    };
    /**
     * take routes group map and gather all voyages
     * @param  Map routesGroupMap
     * @return Array all VoyagesPair
     */
    function gatherAllVoys(routesGroupMap) {
        let allVoys = [];
        for (let rid of routesGroupMap.keys()) {
            let pcalls = routesGroupMap.get(rid);
            let voys = getPosblVoyByPortcalls(pcalls);
            allVoys = allVoys.concat(voys)
        }
        return allVoys;
    };
    /**
     * group by departure port
     * @param  Array allVoys
     * @return Map <departure port ,VoyagePair Array>
     */
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
    /**
     * filter invalid transhipment targets by date and return all valid targets
     * @param  Date departure date
     * @param  Array transhipment Target List
     * @return Array all valid transhipment Target
     */
    function filterTranTargetByDate(depPort, tranTargetList) {
        let result = [];
        //if (!depDate) return result;
        let ETA = new Date(depPort.eta);
        let ETD = new Date(depPort.etd);

        tranTargetList.forEach((target) => {
            let targetETA = new Date(target.startPort.eta);
            if (targetETA >= ETA && targetETA < ETD) {
                result.push(target);
            }
        });
        return result;
    }

    function checkIfExist(callMap, voyDepPortId, voyArrPortId) {
        let portIdList = callMap.get(voyDepPortId) || [];
        let index = portIdList.indexOf(voyArrPortId);
        return index >= 0;
    }

    /**
     * append transhipments to result set and return
     * @param  Array all voyages
     * @param  Map voyage port Map
     * @return Array all voyages include transhipments
     */
    function appendTranshipments2Voys(allVoys, voyPortMap) {
        let transList = [];
        let callMap = new Map();
        allVoys.forEach(function(voy) {
            let port = voy.startPort.port;
            let depDate = voy.startPort.eta;
            let tranTargetList = voyPortMap.get(port);
            let tempTransList = [];
            // target voyages whose departure date should be later than current departure date 
            let filteredTranTargetList = filterTranTargetByDate(voy.startPort, tranTargetList);
            filteredTranTargetList.forEach((target) => {
                if (voy.startPort.routeId != target.startPort.routeId) {
                    let voyPair = new VoyagesPair(voy.startPort, target.startPort, true);
                    let voyDepPortId = voy.startPort.id;
                    let voyArrPortId = target.startPort.id
                    if (!callMap.has(voyDepPortId)) {
                        callMap.set(voyDepPortId, []);
                    }
                    if (!checkIfExist(callMap, voyDepPortId, voyArrPortId)) {
                        transList.push(voyPair);
                        callMap.get(voyDepPortId).push(voyArrPortId);
                    }
                }
            });
            //transList = transList.concat(tempTransList);
            //console.log(tempTransList);
        });
        //console.log(allVoys.concat(transList));
        return allVoys.concat(transList);
    }
    /**
     * @param  date etd
     * @param  date eta
     * @param  Boolean trshipEnabled  enable transhipment flag 
     * @param  Function cb
     */
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
                let routeMap = groupRoutesByRouteId(calls);
                let allVoys = gatherAllVoys(routeMap);
                if (trshipEnabled) {
                    let voysDepMap = groupVoyByDepPort(allVoys);
                    allVoys = appendTranshipments2Voys(allVoys, voysDepMap);
                }
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