class WT_FlightPlanAsoboInterface {
    constructor(icaoWaypointFactory) {
        this._icaoWaypointFactory = icaoWaypointFactory;
    }

    async getGameActiveWaypointIndex() {
        return Coherent.call("GET_ACTIVE_WAYPOINT_INDEX");
    }

    getGameActiveWaypointIdent() {
        return SimVar.GetSimVarValue("GPS WP NEXT ID", "string");
    }

    isApproachActive() {
        return SimVar.GetSimVarValue("C:fs9gps:FlightPlanIsActiveApproach", "Bool");
    }

    /**
     *
     * @param {WT_FlightPlan} flightPlan
     */
    async syncFromGame(flightPlan) {
        let data = await Coherent.call("GET_FLIGHTPLAN");
        let tempFlightPlan = new WT_FlightPlan(this._icaoWaypointFactory);
        let isDirectTo = data.isDirectTo;
        if (!isDirectTo) {
            if (data.waypoints.length === 0) {
                return;
            }
            let firstICAO = data.waypoints[0].icao;
            let origin;
            if (firstICAO[0] === "A") {
                origin = await this._icaoWaypointFactory.getAirport(firstICAO);
                tempFlightPlan.setOrigin(origin);
            }
            let lastICAO = data.waypoints[data.waypoints.length - 1].icao;
            let destination;
            if (data.waypoints.length > 1 && lastICAO[0] === "A") {
                destination = await this._icaoWaypointFactory.getAirport(data.waypoints[data.waypoints.length - 1].icao);
                tempFlightPlan.setDestination(destination);
            }

            if (data.departureProcIndex >= 0) {
                await tempFlightPlan.setDepartureIndex(data.departureProcIndex, data.departureRunwayIndex, data.departureEnRouteTransitionIndex);
            }

            let enrouteStart = (data.departureWaypointsSize === -1) ? (origin ? 1 : 0) : data.departureWaypointsSize;
            let enrouteEnd = data.waypoints.length - (destination ? 1 : 0) - (data.arrivalWaypointsSize === -1 ? 0 : data.arrivalWaypointsSize);
            let enrouteICAOs = data.waypoints.slice(enrouteStart, enrouteEnd);
            let waypoints = [];
            for (let leg of enrouteICAOs) {
                try {
                    waypoints.push(await this._icaoWaypointFactory.getWaypoint(leg.icao));
                } catch (e) {}
            }
            await tempFlightPlan.insertEnrouteWaypoints(waypoints);

            if (data.arrivalProcIndex >= 0) {
                await tempFlightPlan.setArrivalIndex(data.arrivalProcIndex, data.arrivalEnRouteTransitionIndex);
            }
            if (data.approachIndex >= 0) {
                await tempFlightPlan.setApproachIndex(data.approachIndex, data.approachTransitionIndex);
            }
            flightPlan.copyFrom(tempFlightPlan);
        }
    }

    /**
     *
     * @param {WT_FlightPlan} flightPlan
     * @param {Number} [index]
     */
    async syncToGame(flightPlan, index = 0) {
        await Coherent.call("SET_CURRENT_FLIGHTPLAN_INDEX", index);
        await Coherent.call("CLEAR_CURRENT_FLIGHT_PLAN");
        if (flightPlan.hasOrigin() && flightPlan.hasDestination()) {
            await Coherent.call("SET_ORIGIN", flightPlan.getOrigin().icao);
            await Coherent.call("SET_DESTINATION", flightPlan.getDestination().icao);
            let count = 1;
            for (let leg of flightPlan.getEnroute().legs()) {
                let waypoint = leg.waypoint;
                if (waypoint && waypoint.icao) {
                    await Coherent.call("ADD_WAYPOINT", waypoint.icao, count, false);
                    count++;
                }
            }
            //await Coherent.call("SET_ACTIVE_WAYPOINT_INDEX", fpln.getActiveWaypointIndex());
            if (flightPlan.hasDeparture()) {
                let departure = flightPlan.getDeparture();
                //await Coherent.call("SET_ORIGIN_RUNWAY_INDEX", plan.procedureDetails.originRunwayIndex);
                await Coherent.call("SET_DEPARTURE_PROC_INDEX", departure.procedure.index);
                await Coherent.call("SET_DEPARTURE_RUNWAY_INDEX", departure.runwayTransitionIndex);
                await Coherent.call("SET_DEPARTURE_ENROUTE_TRANSITION_INDEX", departure.enrouteTransitionIndex);
            }
            if (flightPlan.hasArrival()) {
                let arrival = flightPlan.getArrival();
                await Coherent.call("SET_ARRIVAL_PROC_INDEX", arrival.procedure.index);
                await Coherent.call("SET_ARRIVAL_RUNWAY_INDEX", arrival.runwayTransitionIndex);
                await Coherent.call("SET_ARRIVAL_ENROUTE_TRANSITION_INDEX", arrival.enrouteTransitionIndex);
            }
            if (flightPlan.hasApproach()) {
                let approach = flightPlan.getApproach();
                await Coherent.call("SET_APPROACH_INDEX", approach.procedure.index);
                await Coherent.call("SET_APPROACH_TRANSITION_INDEX", approach.transitionIndex);
            }
        }
        //Coherent.call("SET_ACTIVE_WAYPOINT_INDEX", fpln.getActiveWaypointIndex() + 1);
        await Coherent.call("LOAD_CURRENT_ATC_FLIGHTPLAN");
    }
}