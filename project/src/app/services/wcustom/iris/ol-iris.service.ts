
import {throwError as observableThrowError,  Observable } from 'rxjs';

import {catchError, map} from 'rxjs/operators';

import { CSWRecordModel } from 'portal-core-ui';
import { Injectable, Inject } from '@angular/core';
import {HttpClient, HttpParams, HttpResponse} from '@angular/common/http';
import {LayerModel} from 'portal-core-ui';
import { OnlineResourceModel } from 'portal-core-ui';
import { LayerHandlerService } from 'portal-core-ui';
import { OlMapObject } from 'portal-core-ui';
import olMap from 'ol/Map';
import olLayerVector from 'ol/layer/Vector';
import olSourceVector from 'ol/source/Vector';
import olFormatKML from 'ol/format/KML';
import olStyle from 'ol/style/Style';
import olStyleCircle from 'ol/style/Circle';
import olStyleFill from 'ol/style/Fill';
import olStyleStroke from 'ol/style/Stroke';
import olStyleText from 'ol/style/Text';
import { Constants } from 'portal-core-ui';
import { RenderStatusService } from 'portal-core-ui';

/**
 * Use OlMapService to add layer to map. This service class adds wfs layer to the map
 */
@Injectable()
export class OlIrisService {

  private map: olMap;

  constructor(private olMapObject: OlMapObject, private layerHandlerService: LayerHandlerService,
                  private http: HttpClient,
                  private renderStatusService: RenderStatusService, @Inject('env') private env) {
    this.map = this.olMapObject.getMap();
  }

  /**
   * A get feature request
   * @param layer the wfs layer for the getfeature request to be made
   * @param onlineresource the wfs online resource
   * @return Observable the observable from the http request
   */
  public getKMLFeature(layer: LayerModel, onlineResource: OnlineResourceModel): Observable<any> {

    const irisResources = this.layerHandlerService.getOnlineResources(layer, Constants.resourceType.IRIS);
    const irisResource = irisResources[0];
    const serviceUrl = irisResource.url;
    const networkCode = irisResource.name;

    let httpParams = new HttpParams();
    httpParams = httpParams.append('serviceUrl', irisResource.url);
    httpParams = httpParams.append('networkCode', irisResource.name);


    if (layer.proxyUrl) {
      return this.http.get(this.env.portalBaseUrl + layer.proxyUrl, {
        params: httpParams
      }).pipe(map(response => {
        if (response['success'] === true) {
          return response['msg'];
        } else {
          return observableThrowError(response['Error retriving IRIS data']);
        }
      }), catchError(
        (error: HttpResponse<any>) => {
          return observableThrowError(error);
        }
      ), );
    };
  }

  /**
   * Creates style for the points on the map
   * 
   * @param label label attached to data point on map
   * @returns openlayers style object
   */
  private irisStyleFunction(label: string) {
      var dotStyle = new olStyle({
        // Makes a circle with white boundary and purple inner
        image: new olStyleCircle({
          radius: 5,
          stroke: new olStyleStroke({
            color: 'white',
            width: 2
          }),
          fill: new olStyleFill({
            color: 'purple'
          })
        }),
        // Dark grey writing
        text: new olStyleText({
          text: label,
          textAlign: 'left',
          font: '12px roboto,sans-serif',
          fill: new olStyleFill({
              color: '#33333'
          }),
          offsetX: 6,
          offsetY: 0,
        })
      });
      return dotStyle;
    }

  /**
   * Add the wfs layer
   * @param layer the layer to add to the map
   * @param the wfs layer to be added to the map
   */
  public addLayer(layer: LayerModel, param?: any): void {
    const irisOnlineResources = this.layerHandlerService.getOnlineResources(layer, Constants.resourceType.IRIS);

    for (const onlineResource of irisOnlineResources) {

      this.renderStatusService.addResource(layer, onlineResource);

      this.getKMLFeature(layer, onlineResource).subscribe(response => {
        this.renderStatusService.updateComplete(layer, onlineResource);
        // Set extractStyles = false to disable default style
        const features = new olFormatKML({extractStyles: false}).readFeatures(response, {
          dataProjection: 'EPSG:4326',
          featureProjection: Constants.MAP_PROJ
        });
        // Loop over features and apply new style and LayerVector for each feature
        features.forEach(feature => {
          const kmlLayer = new olLayerVector({
            source: new olSourceVector({features: []}),
            style: this.irisStyleFunction(feature.get('name'))
          });
          feature.layer = layer;
          kmlLayer.getSource().addFeature(feature);
          this.olMapObject.addLayerById(kmlLayer, layer.id);
        });
      },
        err => {
          this.renderStatusService.updateComplete(layer, onlineResource, true);
        });
    }
  }

  public addCSWRecord(cswRecord: CSWRecordModel) {

  }


}
