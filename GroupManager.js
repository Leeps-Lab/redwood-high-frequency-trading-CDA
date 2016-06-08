Redwood.factory("GroupManager", function () {
   var api = {};

   api.createGroupManager = function(groupArgs, sendFunction){
      var groupManager = {};

      groupManager.marketAlgorithms = {};   // reference to all market algorithms in this group, mapped by subject id ---> marketAlgorithms[subjectID]
      groupManager.market = {};             // reference to the market object for this group
      
      groupManager.priceChanges = groupArgs.priceChanges;         // array of all price changes that will occur
      groupManager.investorArrivals = groupArgs.investorArrivals; // array of all investor arrivals that will occur
      groupManager.priceIndex = 0;                                // index of last price index to occur
      groupManager.investorIndex = 0;                             // index of last investor arrival to occur
      
      groupManager.groupNumber = groupArgs.groupNumber;
      groupManager.memberIDs = groupArgs.memberIDs; // array that contains id number for each subject in this group
      groupManager.syncFpArray = [];                // buffer that holds onto messages until recved msg from all subjects
      groupManager.msgWaitList = [];                // buffer that holds onto outgoing messages for an amount of delay to simulate latency
      groupManager.delay = 500;                     // # of milliseconds that will be delayed by latency simulation

      groupManager.syncFPArray = new synchronizeArray(groupManager.memberIDs);
      groupManager.FPMsgList = [];

      groupManager.isDebug = groupArgs.isDebug;     //indicates if message logger should be used

      if(groupManager.isDebug){
        // add the logging terminal to the ui section of the html
        $("#ui").append('<div class="terminal-wrap"><div class="terminal-head">Group ' + groupManager.groupNumber + 
          ' Message Log</div><div id="group-' + groupManager.groupNumber + '-log" class="terminal"></div></div>');
        groupManager.logger = new MessageLogger("Group Manager " + String(groupManager.groupNumber), "#5555FF", "group-" + groupManager.groupNumber + "-log");
      }

      // wrapper for the redwood send function
      groupManager.rssend = function (key, value) {
        sendFunction (key, value, "admin", 1, this.groupNumber);
      };

      // sends a message to all of the market algorithms in this group
      groupManager.sendToMarketAlgorithms = function(msg){
        for(var memberID of this.memberIDs){
          this.marketAlgorithms[memberID].recvFromGroupManager(msg);
        }
      };

      // recv a message from a single market algorithm in this group
      groupManager.recvFromMarketAlgorithm = function(msg){
        
        if(this.isDebug){
          this.logger.logRecv(msg, "Market Algorithm");
        }

        // synchronized message in response to fundemental price change
        if(msg.protocol === "SYNC_FP"){
          //mark that this user sent msg
          this.syncFPArray.markReady(msg.msgData[0]);
          this.FPMsgList.push(msg);

          // check if every user has sent a response
          if(this.syncFPArray.allReady()){
            // shuffle the order of messages sitting in the arrays
            var indexOrder = this.getRandomMsgOrder(this.FPMsgList.length);

            // send msgs in new shuffled order
            for(var index of indexOrder){
              for(var rmsg of this.FPMsgList[index].msgData[2]){
                this.sendToMarket(rmsg);
              }
            }

            // reset arrays for the next fundemental price change
            this.FPMsgList = [];
            this.syncFPArray = new synchronizeArray(this.memberIDs);
          }
        }

        // general message that needs to be passed on to marketManager
        if(msg.protocol === "OUCH"){
          groupManager.sendToMarket(msg);
        }
      };

      // this sends message to market with specified amount of delay
      groupManager.sendToMarket = function(msg){
        //If no delay send msg now, otherwise push it onto wait list with tag for what time msg should be sent
        if(msg.delay){
          this.msgWaitList.push([Date.now() + this.delay, msg]);
        }
        else{
          this.market.recvMessage(msg);
        }
      };

      // handles a message from the market
      groupManager.recvFromMarket = function(msg){
        
        if(this.isDebug){
          this.logger.logRecv(msg, "Market");
        }

        switch (msg.msgType){
          case "C_EBUY"  :
          case "C_ESELL" :
          case "C_RBUY"  :
          case "C_RSELL" :
          case "C_UBUY"  :
          case "C_USELL" : this.marketAlgorithms[msg.msgData[0]].recvFromGroupManager(msg); break;
          case "C_TRA"   : this.sendToMarketAlgorithms(msg);
        }
      };

      // handles message from subject and passes it on to market algorithm
      groupManager.recvFromSubject = function(msg){
         
        if(this.isDebug){
          this.logger.logRecv(msg, "Subjects");
        }

        // if this is a user message, handle it and don't send it to market
        if(msg.protocol === "USER"){
          var subjectID = msg.msgData[0];
          this.marketAlgorithms[subjectID].recvFromGroupManager(msg);
        }
      };

      // creates an array from 0 to size-1 that are shuffled in random order
      groupManager.getRandomMsgOrder = function(size){
        
        // init indices from 0 to size-1
        var indices = [];
        var rand;
        var temp;
        for(var i = 0; i < size; i++){ indices.push(i); }

        // shuffle
        for(i = size-1; i > 0; i--){
          rand = Math.floor(Math.random() * size);
          temp = indices[i];
          indices[i] = indices[rand];
          indices[rand] = temp;
        }
        return indices;
      };

      groupManager.update = function(){

        // check if msgs on wait list need to be sent
        if(this.msgWaitList.length > 0){
          while(this.msgWaitList[0][0] < Date.now()){
            this.market.recvMessage(this.msgWaitList[0][1]);
            this.msgWaitList.shift();
            if(this.msgWaitList.length === 0){
              break;
            }
          }
        }

        //Looks for change in fundamental price and sends message if change is found
         while(this.priceIndex < this.priceChanges.length
               && Date.now() > this.priceChanges[this.priceIndex][0] + this.startTime) {
            var msg = new Message("ITCH", "FPC", [Date.now(), this.priceChanges[this.priceIndex][1], this.priceIndex]);
            this.sendToMarketAlgorithms(msg);
            this.priceIndex++;
         }

         //looks for investor arrivals and sends message if one has occured
         while(this.investorIndex < this.investorArrivals.length
               && Date.now() > this.investorArrivals[this.investorIndex][0] + this.startTime) {
            var msg = new Message("OUCH", this.investorArrivals[this.investorIndex][1] == 1 ? "EBUY" : "ESELL", [0, 214748.3647, true]);
            this.sendToMarket(msg);
            this.investorIndex++;
         }
      };

      // pulls out the initial fundemental price for this group and removes that element from the fundemental price array
      groupManager.getStartFP = function(){
        var temp = this.priceChanges.shift();
        return temp[1];
      };

      return groupManager;
   };

   return api;
});
