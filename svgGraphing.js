/* Angular service used for creating svg elements that graphically represent a market
*  Created by Zachary Petersen - zacharypetersen1@gmail.com
*
*  To use this service, inject it and call makeTradingGraph(svgElementID)
*     This will return a new graph object. Call graph.init(timeStamp) to
*     initialize the graph, call graph.draw(timeStamp) to update the graph.
*/
RedwoodHighFrequencyTrading.factory("SVGGraphing", function () {
   var api = {};

   //Call this function to create a new graph object. Pass in the id
   //    of the svg element that the graph will be tied to.
   api.makeTradingGraph = function(svgElementID){
      var graph = {};

      graph.elementId = svgElementID;  //id of the svg element
      graph.elementWidth = 0;          //Width and Height of svg element
      graph.elementHeight = 0;         //    (use calculateSize to determine)
      graph.axisLabelWidth = 40;       //Width of area where price axis labels are drawn
      graph.svg = d3.select('#'+ graph.elementId); //svg element
      graph.minPrice = 5;              //min price on price axis
      graph.maxPrice = 25;             //max price on price axis
      graph.priceGridIncriment = 5;    //amount between each line on price axis
      graph.timeInterval = 30;         //Amount in seconds displayed at once on full time axis
      graph.timeIncriment = 5;         //Amount in seconds between lines on time axis
      graph.currentTime = 0;           //Time displayed on graph
      graph.priceLines = [];           //
      graph.timeLines = [];
      graph.startTime = 0;
      graph.pricesArray = [];
      graph.dataObj = {
         prices: [],
         buyOffers: [],
         sellOffers: [],
         drawData: []
      };

      graph.calculateSize = function(){
         this.elementWidth = $('#'+ this.elementId).width();
         this.elementHeight = $('#'+ this.elementId).height();
      }

      graph.getSize = function(){
         return [this.elementWidth, this.elementHeight];
      }

      graph.mapPriceToYAxis = function(price){
         var percentOffset = (this.maxPrice - price) / (this.maxPrice - this.minPrice);
         return this.elementHeight * percentOffset;
      }

      graph.mapTimeToXAxis = function(timeStamp){
         var percentOffset = (timeStamp - (this.currentTime - (this.timeInterval * 1000))) / (this.timeInterval * 1000);
         return (this.elementWidth - this.axisLabelWidth) * percentOffset;
      }

      graph.priceUnit = function(){
         return this.elementHeight / (this.maxPrice - this.minPrice);
      }

      graph.millisToTime = function(timeStamp){
         var x = timeStamp / 1000;
         var seconds = parseInt(x % 60);
         x /= 60;
         var minutes = parseInt(x % 60);
         
         x /= 60;
         var hours = parseInt(x % 24);
         return hours + ":" + minutes + ":" + seconds;
      }

      graph.calcPriceGridLines = function(){
         var gridLineVal = this.minPrice + this.priceGridIncriment - (this.minPrice % this.priceGridIncriment);
         var lines = [];
         while(gridLineVal < this.maxPrice){
            lines.push(gridLineVal);
            gridLineVal += this.priceGridIncriment;
         }
         return lines;
      }

      graph.calcTimeGridLines = function(timeStamp){
         var timeLineVal = timeStamp - (timeStamp % (this.timeIncriment * 1000));
         var lines = [];
         while(timeLineVal > timeStamp - this.timeInterval * 1000){
            lines.push(timeLineVal);
            timeLineVal -= this.timeIncriment * 1000;
         }
         lines.push(timeLineVal);
         return lines;
      }

      graph.getTimeGridClass = function(timeStamp){
         if(timeStamp % (this.timeIncriment * 2000) == 0)
            return "time-grid-box-light";
         else return "time-grid-box-dark";
      }

      graph.draw = function(timeStamp){
         //Clear the svg element
         this.svg.selectAll("*").remove();
         //Record time
         this.currentTime = timeStamp;

         var graphRefr = this;

         var drawData = this.dataObj.drawData;

         if(this.currentTime > this.timeLines[0] + this.timeIncriment){
            this.timeLines = this.calcTimeGridLines(this.currentTime);
         }

         //Draw rectangles for time gridlines
         this.svg.selectAll("rect")
            .data(this.timeLines)
            .enter()
            .append("rect")
            .attr("x", function(d){return graphRefr.mapTimeToXAxis(d);})
            .attr("y", 0)
            .attr("width", this.timeIncriment / this.timeInterval * (this.elementWidth - this.axisLabelWidth))
            .attr("height", this.elementHeight)
            .attr("class", function(d){return graphRefr.getTimeGridClass(d);});
         //Draw labels for time gridlines
         this.svg.selectAll("text.time-grid-line-text")
            .data(this.timeLines)
            .enter()
            .append("text")
            .attr("text-anchor", "start")
            .attr("x", function(d){return graphRefr.mapTimeToXAxis(d)+5;})
            .attr("y", this.elementHeight-5)
            .text(function(d) {return graphRefr.millisToTime(d)})
            .attr("class", "time-grid-line-text");
         //Draw the lines for the price gridlines
         this.svg.selectAll("line.price-grid-line")
            .data(this.priceLines)
            .enter()
            .append("line")
            .attr("x1", 0)
            .attr("x2", this.elementWidth - this.axisLabelWidth)
            .attr("y1", function(d) {return graphRefr.mapPriceToYAxis(d);})
            .attr("y2", function(d) {return graphRefr.mapPriceToYAxis(d);})
            .attr("class", "price-grid-line");
         //Draw the price line
         this.svg.selectAll("line.price-line")
            .data(drawData)
            .enter()
            .append("line")
            .attr("x1", function(d){ return graphRefr.mapTimeToXAxis( d.price[0] + graphRefr.startTime ); })
            .attr("x2", function(d, i){
               if(i != drawData.length-1)
                  return graphRefr.mapTimeToXAxis( drawData[i+1].price[0] + graphRefr.startTime );
               else
                  return graphRefr.elementWidth - graphRefr.axisLabelWidth;
            })
            .attr("y1", function(d){ return graphRefr.mapPriceToYAxis(d.price[1]); })
            .attr("y2", function(d){ return graphRefr.mapPriceToYAxis(d.price[1]); })
            .attr("class", "price-line");
         //Draw the spread over the price line
         this.svg.selectAll("rect.spread")
            .data(drawData)
            .enter()
            .append("rect")
            .attr("x", function(d){ return graphRefr.mapTimeToXAxis( d.price[0] + graphRefr.startTime ); })
            .attr("width", function(d, i){
               var startLoc = graphRefr.mapTimeToXAxis( d.price[0] + graphRefr.startTime );
               if (i != drawData.length-1) {
                  return graphRefr.mapTimeToXAxis( drawData[i+1].price[0] + graphRefr.startTime ) - startLoc;
               }
               else {
                  return 0;
               }
            })
            .attr("y", function(d){ return graphRefr.mapPriceToYAxis(d.price[1]) - 2 * graphRefr.priceUnit(); })
            .attr("height", 4 * graphRefr.priceUnit())
            .attr("class", "spread");
         //Draw rectangle on right side for price axis
         this.svg.append("rect")
            .attr("x", this.elementWidth - this.axisLabelWidth)
            .attr("y", 0)
            .attr("width", this.axisLabelWidth)
            .attr("height", this.elementHeight)
            .attr("class", "price-axis-box");
         //Draw the text that goes along with the price gridlines and axis
         this.svg.selectAll("text.price-grid-line-text")
            .data(this.priceLines)
            .enter()
            .append("text")
            .attr("text-anchor", "start")
            .attr("x", this.elementWidth - this.axisLabelWidth + 5)
            .attr("y", function(d) {return graphRefr.mapPriceToYAxis(d);})
            .attr("class", "price-grid-line-text")
            .text(function(d) {return d;});
      }

      graph.init = function(timeStamp, pricesArray, buyOffersArray){
         this.calculateSize();
         this.priceLines = this.calcPriceGridLines();
         this.timeLines = this.calcTimeGridLines(this.currentTime);
         this.startTime = timeStamp;
         var buyIndex = 0;
         var sellIndex = 0;
         var i = 0;

         //Create price segment for each time the price changes
         for(i; i < pricesArray.length; i++){
            this.dataObj.drawData.push({price: pricesArray[i], buyOffers: []});
            
            //Loop through and add all buy offers that fit on this price segment
            while (buyIndex < buyOffersArray.length) {
               //On last Price segment, keep inserting until no more buy offers
               if (i == pricesArray.length-1){
                  this.dataObj.drawData[i].buyOffers.push(buyOffersArray[buyIndex]);
                  buyIndex++;
                  continue;
               }
               //Check if this is the right price segment to insert on
               if (buyOffersArray[buyIndex][0] < pricesArray[i+1][0]) {
                  this.dataObj.drawData[i].buyOffers.push(buyOffersArray[buyIndex]);
                  buyIndex++;
                  continue;
               }
               else {
                  break;
               }
            }
         }
         console.log(this.dataObj.drawData);
         this.draw(timeStamp);
      }

      return graph;
   }



   return api;

});
