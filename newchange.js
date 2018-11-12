function ReadEmailTextAndAttachment(auth, message_id, markread){
  var text1 = ''; 
  var message_id='166f83df64b48635'
  gmail.users.messages.get({ auth: auth, userId: 'me', id:message_id,format:'full' },
    function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
    
    var emailConfig=response['data'].payload.parts;
        for(var i = 0; i < emailConfig.length; i++){
    if(emailConfig[i].mimeType=="application/pdf"){
        var pdf_attachmentId=emailConfig[i].body.attachmentId;
        if(pdf_attachmentId!==null){
            GetAttachmentDataToPdf(auth,message_id,pdf_attachmentId);
        }
    }else{
        var parts=emailConfig[i].parts;
        for(var j=0;j<parts.length;j++){
            if(parts[j].mimeType=="text/plain"){
                GetEmailBodymessageToPdf(parts[j].body.data); 
            }
        }
    }
}
    });


}

function GetAttachmentDataToPdf(auth,message_id,pdf_attachmentId){
    gmail.users.messages.attachments.get({ auth: auth, userId: 'me', id:pdf_attachmentId,messageId:message_id },
    function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      var pdfData=response['data'].data;
     
      d=dat; 
      var t=joinBase64Strings(d,pdfData);
      base64.base64Decode(pdfData, 'attachedPdfdata.pdf');
      base64.base64Decode(t, 'combined.pdf');
    });
}


function GetEmailBodymessageToPdf(message){
  dat=message
  base64.base64Decode(message, 'emailBodyMessage.pdf');
}

function joinBase64Strings(base64Str1, base64Str2) {
  const bothData = Buffer.from(base64Str1, 'base64').toString('binary') 
        + Buffer.from(base64Str2, 'base64').toString('binary');
  const joinedBase64Result = Buffer.from(bothData.toString(), 'binary').toString('base64');
  return joinedBase64Result;
}