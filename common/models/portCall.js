'use strict';

module.exports = function(PortCall) {
    /**
     * voyage pair class
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
     * @param  {Array} portCalls
     * @return {Map} <routeId,portCalls Array>  
     */
    function groupPortCallsByRouteId(portCalls) {
        let portCallMap = new Map();
        portCalls.forEach((elem) => {
            if (!portCallMap.has(elem.routeId)) {
                portCallMap.set(elem.routeId, []);
            }
            portCallMap.get(elem.routeId).push(elem);
        });
        return portCallMap;
    };
    /**
     * check whether the voyage port pair is valid to avoid repeated port pair
     * @param {Map} listMap <id,Array>
     * @param {*} depPort 
     * @param {*} arrPort 
     */
    function checkValidity(listMap, depPort, arrPort) {
        if (depPort.port === arrPort.port) return false;
        let arrPortList = [];
        var result = true;
        if (listMap.has(depPort.id)) {
            arrPortList = listMap.get(depPort.id);
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
     * @param  {Array} portCallsList
     * @return {Array} VoyagesPair array
     */
    function getPosblVoyByPortcalls(portCallsList) {
        let voyagesPairList = [];
        let listMap = new Map();
        const len = portCallsList.length;
        for (let i = 0; i < len; i++) {
            let depPort = portCallsList[i];
            if (!listMap.has(depPort.id)) {
                listMap.set(depPort.id, []);
            }
            for (let j = i + 1; j < len; j++) {
                let arrPort = portCallsList[j];
                //filter invalid voyage pairs , repeated voyage pairs
                //departure port's arrival ports should be different for each port call
                if (checkValidity(listMap, depPort, arrPort)) {
                    let voy = new VoyagesPair(depPort, arrPort);
                    voyagesPairList.push(voy);
                    listMap.get(depPort.id).push(arrPort);
                }
            }
        }
        return voyagesPairList;
    };
    /**
     * take routes group map and gather all voyages
     * @param  {Map} routesGroupMap
     * @return {Array} all VoyagesPair
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
     * @param  {Array} allVoys
     * @return {Map} <departure port ,VoyagePair Array>
     */
    function groupVoyByDepPort(allVoys) {
        let voyMap = new Map();
        allVoys.forEach((voy) => {
            if (!voyMap.has(voy.startPort.port)) {
                voyMap.set(voy.startPort.port, []);
            }
            voyMap.get(voy.startPort.port).push(voy);
        });
        return voyMap;
    };
    /**
     * filter invalid transhipment targets by eta/etd and return all valid targets
     * @param  {Date} departure date
     * @param  {Array} transhipment Target List
     * @return {Array} all valid transhipment Target
     */
    function filterTranTargetByDate(depPort, tranTargetList) {
        let result = [];
        let ETA = new Date(depPort.eta);
        let ETD = new Date(depPort.etd);
        tranTargetList.forEach((target) => {
            let targetETA = new Date(target.startPort.eta);
            let targetETD = new Date(target.startPort.etd);
            // two port of calls 's time should have intersection 
            if ((ETA >= targetETA && ETA < targetETD) || (targetETA >= ETA && targetETA < ETD)) {
                result.push(target);
            }
        });
        return result;
    }
    /**
     * check whether the transhipment is duplicated
     * @param {Map} callMap  <id,[id,]>
     * @param {Number} voyDepPortId 
     * @param {Number} voyArrPortId 
     */
    function checkIfExist(listMap, voyDepPortId, voyArrPortId) {
        let portIdList = listMap.get(voyDepPortId) || [];
        let index = portIdList.indexOf(voyArrPortId);
        return index >= 0;
    }

    /**
     * append transhipments to result set and return
     * @param  {Array} all voyages
     * @param  {Map} voyage port Map
     * @return {Array} all voyages include transhipments
     */
    function appendTranshipments2Voys(allVoys, voyPortMap) {
        let transList = [];
        let listMap = new Map();
        allVoys.forEach((voy) => {
            let port = voy.startPort.port;
            let tranTargetList = voyPortMap.get(port);
            // two port of calls' eta-etd should have intersection
            let filteredTranTargetList = filterTranTargetByDate(voy.startPort, tranTargetList);
            filteredTranTargetList.forEach((target) => {
                if (voy.startPort.routeId != target.startPort.routeId) {
                    let voyPair = new VoyagesPair(voy.startPort, target.startPort, true);
                    let voyDepPortId = voy.startPort.id;
                    let voyArrPortId = target.startPort.id
                    if (!listMap.has(voyDepPortId)) {
                        listMap.set(voyDepPortId, []);
                    }
                    if (!checkIfExist(listMap, voyDepPortId, voyArrPortId)) {
                        transList.push(voyPair);
                        listMap.get(voyDepPortId).push(voyArrPortId);
                    }
                }
            });
        });
        return allVoys.concat(transList);
    }
    /**
     * @param  {date} etd
     * @param  {date} eta
     * @param  {Boolean} trshipEnabled  enable transhipment flag 
     * @param  {Function} cb
     */
    PortCall.getVoyages = function(etd, eta, trshipEnabled, cb) {
        // For more information on how to query data in loopback please see
        // https://docs.strongloop.com/display/public/LB/Querying+data
        let query = {
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
                let portCallMap = groupPortCallsByRouteId(calls);
                let allVoys = gatherAllVoys(portCallMap);
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